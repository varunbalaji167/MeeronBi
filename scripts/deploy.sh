#!/usr/bin/env bash
#
# Atomic, health-gated release deploy. Runs ON THE SERVER.
#
# The CI workflow pipes this file over SSH (`ssh host 'bash -s -- <sha>' <
# scripts/deploy.sh`), so the script that runs is always the one from the
# commit being deployed — there is no stale copy to drift on the box.
#
#   /var/www/meeronbi/
#     repo/              bare git mirror, fetched with the read-only deploy key
#     releases/<sha>/     one extracted + built release
#     shared/.env         the one real .env, symlinked into every release
#     shared/logs/        pm2 logs, so they survive release pruning
#     current -> releases/<sha>
#
# A release is built in full while the previous one keeps serving. Only once
# it builds does the `current` symlink flip; if the new release then fails its
# health probe, the symlink flips back and pm2 reloads the previous build.
# Rollback is a symlink flip, so it costs seconds rather than a rebuild.
#
# IMPORTANT — rollback restores CODE, NOT THE DATABASE. `prisma migrate deploy`
# runs before the flip and Prisma has no down-migrations, so a rolled-back
# release runs against the newer schema. Every migration must therefore be
# backward-compatible with the release before it: add columns, don't drop or
# rename them in the same deploy that starts using them. Split a destructive
# change across two deploys (stop using it, ship, then drop it).
#
# Usage (normally invoked by .github/workflows/deploy.yml):
#   bash deploy.sh <git-sha>
#   bash deploy.sh --rollback          # flip back to the previous release

set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/var/www/meeronbi}"
APP_NAME="${APP_NAME:-meeronbi}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
BRANCH="${BRANCH:-main}"

REPO_DIR="$APP_ROOT/repo"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31mdeploy failed: %s\033[0m\n' "$*" >&2; exit 1; }

# --- Preflight ------------------------------------------------------------
# Checked before anything is touched, so a misconfigured box fails without
# having half-applied a deploy.
preflight() {
  for cmd in git node npm pm2 curl; do
    command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is not on PATH for this SSH session"
  done
  [[ -d "$REPO_DIR" ]]        || die "$REPO_DIR missing — see 'Provisioning a new instance' in docs/DEPLOYMENT.md"
  [[ -f "$SHARED_DIR/.env" ]] || die "$SHARED_DIR/.env missing — the real production environment file lives there"
  mkdir -p "$RELEASES_DIR" "$SHARED_DIR/logs"
}

current_release() {
  [[ -L "$CURRENT_LINK" ]] && basename "$(readlink -f "$CURRENT_LINK")" || true
}

# Atomic even though `current` already exists: ln -sfn onto an existing symlink
# to a directory would create the link *inside* it, so build a temp link and
# rename it over the old one. rename(2) is the atomic part — `mv -T` would also
# work but is GNU-only, and plain `mv` descends into the symlinked directory.
point_current_at() {
  local release_dir="$1"
  ln -sfn "$release_dir" "$CURRENT_LINK.tmp"
  node -e 'require("fs").renameSync(process.argv[1], process.argv[2])' \
    "$CURRENT_LINK.tmp" "$CURRENT_LINK"
}

reload_app() {
  pm2 startOrReload "$CURRENT_LINK/ecosystem.config.cjs" --update-env || return 1
  pm2 save --force >/dev/null 2>&1 || true
}

# Parsed as JSON rather than substring-matched: this decides whether to roll
# back, so it must not hinge on whether the response happens to be formatted
# compactly.
health_body_is_ok() {
  node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const j = JSON.parse(s);
        process.exit(j.status === "ok" && j.checks && j.checks.db === "ok" ? 0 : 1);
      } catch {
        process.exit(1);
      }
    });' 2>/dev/null
}

# Polls rather than sleeping a fixed amount: a cold Next.js start on this box
# is a few seconds, but a migration-heavy release can be slower.
wait_for_health() {
  local attempts="${1:-30}" body
  for ((i = 1; i <= attempts; i++)); do
    body="$(curl -sf --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
    if [[ -n "$body" ]] && printf '%s' "$body" | health_body_is_ok; then
      info "healthy after ${i}s: $body"
      return 0
    fi
    sleep 1
  done
  info "last health response: ${body:-<none>}"
  return 1
}

# --- Rollback -------------------------------------------------------------
rollback_to() {
  local target="$1"
  log "ROLLING BACK to $target"
  point_current_at "$RELEASES_DIR/$target"
  reload_app
  if wait_for_health 30; then
    info "rollback succeeded — the previous release is serving again"
  else
    info "ROLLBACK ALSO FAILED ITS HEALTH CHECK — the site is likely down, investigate immediately"
    pm2 logs "$APP_NAME" --lines 50 --nostream || true
  fi
}

if [[ "${1:-}" == "--rollback" ]]; then
  preflight
  PREVIOUS="$(cat "$SHARED_DIR/previous_release" 2>/dev/null || true)"
  [[ -n "$PREVIOUS" && -d "$RELEASES_DIR/$PREVIOUS" ]] || die "no previous release recorded to roll back to"
  rollback_to "$PREVIOUS"
  exit 0
fi

SHA="${1:-}"
[[ -n "$SHA" ]] || die "usage: deploy.sh <git-sha> | deploy.sh --rollback"

preflight

PREVIOUS_RELEASE="$(current_release)"
RELEASE_DIR="$RELEASES_DIR/$SHA"

log "Deploying $SHA (previous release: ${PREVIOUS_RELEASE:-none})"

# --- Fetch ----------------------------------------------------------------
log "Fetching from origin"
git -C "$REPO_DIR" fetch --prune --quiet origin "+refs/heads/$BRANCH:refs/heads/$BRANCH"
git -C "$REPO_DIR" cat-file -e "${SHA}^{commit}" 2>/dev/null \
  || die "commit $SHA not found in origin/$BRANCH after fetch"

# --- Extract --------------------------------------------------------------
# A fresh extract rather than a checkout: no .git in the release, and a
# re-deploy of the same SHA is a clean rebuild rather than a dirty tree.
log "Extracting release"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
git -C "$REPO_DIR" archive "$SHA" | tar -x -C "$RELEASE_DIR"
ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
info "$RELEASE_DIR"

# --- Build ----------------------------------------------------------------
# Everything up to the flip happens while the previous release is still
# serving, so a failure here is a non-event for users.
cd "$RELEASE_DIR"

log "Installing dependencies"
npm ci --no-audit --no-fund

log "Generating Prisma client"
npx prisma generate

# Before the build, so a rejected migration aborts the deploy without having
# produced a build the symlink might otherwise be flipped to. See the
# backward-compatibility note at the top of this file.
log "Applying database migrations"
npx prisma migrate deploy

log "Building"
npm run build

# Everything from here on runs with the new release live, so each failure
# has to undo the flip rather than just exit.
abort_and_undo() {
  info "$1"
  if [[ -n "$PREVIOUS_RELEASE" && -d "$RELEASES_DIR/$PREVIOUS_RELEASE" ]]; then
    rollback_to "$PREVIOUS_RELEASE"
  else
    info "no previous release to roll back to — leaving $SHA in place for inspection"
  fi
  die "$1"
}

# --- Flip -----------------------------------------------------------------
log "Switching traffic to the new release"
# A plain `[[ ... ]] && cmd` here would return non-zero on the very first
# deploy (no previous release) and `set -e` would abort a healthy deploy.
if [[ -n "$PREVIOUS_RELEASE" ]]; then
  echo "$PREVIOUS_RELEASE" > "$SHARED_DIR/previous_release"
fi
point_current_at "$RELEASE_DIR"
reload_app || abort_and_undo "pm2 failed to start the new release"

# --- Verify, or undo ------------------------------------------------------
log "Health check"
wait_for_health 45 || abort_and_undo "new release did not become healthy"

log "Smoke test"
# No --with-login: this is production, and a scripted sign-in here would be a
# real login attempt against real credentials.
bash "$CURRENT_LINK/scripts/smoke.sh" "http://127.0.0.1:3000" \
  || abort_and_undo "smoke test failed against the new release"

# --- Prune ----------------------------------------------------------------
# Keeps the last few releases so a rollback target always exists; each one is
# a full node_modules + .next, which the droplet's disk notices.
log "Pruning old releases (keeping $KEEP_RELEASES)"
cd "$RELEASES_DIR"
CURRENT_NAME="$(current_release)"
PREVIOUS_KEEP="$(cat "$SHARED_DIR/previous_release" 2>/dev/null || true)"
# `|| true` throughout: the deploy has already succeeded by this point, and
# failing to tidy up old directories must not report it as a failure.
ls -1dt */ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
  old="${old%/}"
  if [[ "$old" == "$CURRENT_NAME" || "$old" == "$PREVIOUS_KEEP" ]]; then
    continue
  fi
  info "removing $old"
  rm -rf "${RELEASES_DIR:?}/$old" || true
done || true

log "Deployed $SHA successfully"
pm2 describe "$APP_NAME" | grep -E "status|uptime|restarts" || true
