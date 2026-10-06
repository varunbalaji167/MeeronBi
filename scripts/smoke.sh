#!/usr/bin/env bash
#
# Black-box probes against a *running* instance of this app.
#
# This is the gate that `npm run lint`/`typecheck`/`test` cannot be: it proves
# the built app actually boots, reaches its database, still renders its public
# pages, and still refuses unauthenticated access to every protected surface.
# A commit that breaks any of that fails here instead of in production.
#
# Used in two places, deliberately the same script:
#   CI      — against a freshly built app + throwaway MySQL (with --with-login)
#   deploy  — against the newly released app before the symlink flip is kept
#
# Usage:
#   scripts/smoke.sh [BASE_URL] [--with-login]
#
# --with-login additionally performs a real NextAuth credentials sign-in using
# $SMOKE_ADMIN_EMAIL / $SMOKE_ADMIN_PASSWORD. Only pass it against a disposable
# instance — never against production, where it would be a real login attempt
# against real credentials.

set -Eeuo pipefail

BASE="${1:-http://127.0.0.1:3000}"
BASE="${BASE%/}"
WITH_LOGIN="${2:-}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
BODY="$TMP/body"
HEAD="$TMP/head"
JAR="$TMP/cookies"

PASSED=0
FAILED=0

pass() {
  printf '  \033[32mok\033[0m    %s\n' "$1"
  PASSED=$((PASSED + 1))
}

fail() {
  printf '  \033[31mFAIL\033[0m  %s\n        %s\n' "$1" "$2"
  FAILED=$((FAILED + 1))
}

# Leaves the status code on stdout, the body in $BODY and the headers in $HEAD.
# curl itself prints 000 when it cannot connect, which is what we want to see.
http() {
  curl -sS -o "$BODY" -D "$HEAD" -w '%{http_code}' --max-time 20 "$@" 2>/dev/null || true
}

expect_status() { # <path> <comma-separated-acceptable-codes> <label>
  local got
  got="$(http "$BASE$1")"
  if [[ ",$2," == *",$got,"* ]]; then
    pass "$3 ($got)"
  else
    fail "$3" "expected HTTP $2 from $1, got ${got:-no response}"
  fi
}

expect_body() { # <substring> <label>
  if grep -qF -- "$1" "$BODY"; then
    pass "$2"
  else
    fail "$2" "response body did not contain: $1"
  fi
}

# Tolerant of whitespace around the colon, so an assertion never turns on how
# compactly the response happens to be serialised.
expect_json_field() { # <field> <value> <label>
  if grep -qE "\"$1\"[[:space:]]*:[[:space:]]*\"$2\"" "$BODY"; then
    pass "$3"
  else
    fail "$3" "expected JSON field \"$1\": \"$2\", body was: $(head -c 200 "$BODY")"
  fi
}

expect_header() { # <header-name> <label>
  if grep -qi "^$1:" "$HEAD"; then
    pass "$2"
  else
    fail "$2" "response header '$1' is missing"
  fi
}

expect_no_header() { # <header-name> <label>
  if grep -qi "^$1:" "$HEAD"; then
    fail "$2" "response header '$1' should never be sent"
  else
    pass "$2"
  fi
}

echo "Smoke-testing $BASE"
echo

# --- Liveness -------------------------------------------------------------
echo "Liveness"
expect_status /api/health 200 "/api/health responds 200"
expect_json_field status ok "/api/health reports status ok"
expect_json_field db ok "/api/health reports a reachable database"

# /api/health is only a liveness check if it re-runs per request. Next.js
# prerendering this route would freeze its answer at build time — a dead
# database would still report "ok". Two spaced calls must disagree.
TS_PATTERN='"timestamp"[[:space:]]*:[[:space:]]*"[^"]*"'
FIRST_TS="$(grep -oE "$TS_PATTERN" "$BODY" || true)"
sleep 1.1
http "$BASE/api/health" >/dev/null
SECOND_TS="$(grep -oE "$TS_PATTERN" "$BODY" || true)"
if [[ -n "$FIRST_TS" && "$FIRST_TS" != "$SECOND_TS" ]]; then
  pass "/api/health is evaluated per request, not prerendered"
else
  fail "/api/health is evaluated per request, not prerendered" \
    "timestamp did not change between calls ($FIRST_TS) — the route is being cached, so it cannot detect a dead database"
fi
echo

# --- Public surfaces ------------------------------------------------------
echo "Public surfaces render"
expect_status /login 200 "/login renders"
expect_status /public/trends 200 "/public/trends renders"
expect_status /researcher-access 200 "/researcher-access renders"
expect_status /forgot-password 200 "/forgot-password renders"
expect_status /set-password 200 "/set-password renders"
expect_status /verify-email 200 "/verify-email renders"
expect_status /api/public/trends 200 "/api/public/trends responds"
expect_status /this-route-does-not-exist 404 "unknown route 404s cleanly"
echo

# --- Password reset request: no account enumeration -----------------------
# A 500 here would mean an unknown address crashes the endpoint instead of returning the same
# response as a real one — exactly the account-enumeration oracle this route must never become.
echo "Password reset request doesn't enumerate accounts"
PWRESET_STATUS="$(http -X POST "$BASE/api/auth/password-reset/request" \
  -H 'Content-Type: application/json' \
  --data '{"email":"no-such-account@example.org"}')"
if [[ "$PWRESET_STATUS" != "500" ]]; then
  pass "POST /api/auth/password-reset/request for an unknown address doesn't 500 ($PWRESET_STATUS)"
else
  fail "POST /api/auth/password-reset/request for an unknown address doesn't 500" "got HTTP 500"
fi
echo

# --- Auth boundary --------------------------------------------------------
# Each of these is a route a logged-out visitor must never reach. A 200 here
# means middleware or a guard stopped being applied — the worst class of
# regression this app can ship, and invisible to lint/typecheck/unit tests.
echo "Auth boundary holds for an unauthenticated visitor"
expect_status /admin 302,307 "/admin redirects to sign-in"
expect_status /patient 302,307 "/patient redirects to sign-in"
expect_status /researcher 302,307 "/researcher redirects to sign-in"
expect_status /api/patients 401 "/api/patients refuses unauthenticated access"
expect_status /api/analytics/fields 401 "/api/analytics/fields refuses unauthenticated access"
expect_status /api/facilities 401 "/api/facilities refuses unauthenticated access"
expect_status /api/patient/me 401 "/api/patient/me refuses unauthenticated access"
echo

# --- Security headers -----------------------------------------------------
# These ship from next.config.mjs's headers(). They are easy to silently drop
# in a config edit and nothing else in the pipeline would notice.
echo "Security headers"
http "$BASE/login" >/dev/null
expect_header "X-Frame-Options" "X-Frame-Options present"
expect_header "X-Content-Type-Options" "X-Content-Type-Options present"
expect_header "Referrer-Policy" "Referrer-Policy present"
expect_header "Permissions-Policy" "Permissions-Policy present"
expect_no_header "X-Powered-By" "X-Powered-By suppressed"

# HSTS is production-only by design (next.config.mjs), so over plain http it is
# correctly absent; only an https origin is expected to send it.
if [[ "$BASE" == https://* ]]; then
  expect_header "Strict-Transport-Security" "Strict-Transport-Security present on https"
fi
echo

# --- Authenticated round-trip (disposable instances only) -----------------
if [[ "$WITH_LOGIN" == "--with-login" ]]; then
  echo "Authenticated round-trip"
  EMAIL="${SMOKE_ADMIN_EMAIL:-}"
  PASSWORD="${SMOKE_ADMIN_PASSWORD:-}"

  if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
    fail "credentials available" "--with-login needs SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD"
  else
    CSRF_STATUS="$(http -c "$JAR" "$BASE/api/auth/csrf")"
    CSRF="$(sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p' "$BODY")"
    if [[ "$CSRF_STATUS" == "200" && -n "$CSRF" ]]; then
      pass "NextAuth issues a CSRF token"
    else
      fail "NextAuth issues a CSRF token" "got HTTP $CSRF_STATUS with no csrfToken"
    fi

    LOGIN_STATUS="$(http -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/callback/credentials" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      --data-urlencode "csrfToken=$CSRF" \
      --data-urlencode "email=$EMAIL" \
      --data-urlencode "password=$PASSWORD" \
      --data-urlencode "callbackUrl=$BASE/admin" \
      --data-urlencode "json=true")"

    # A credentials failure redirects back to /login with ?error= rather than
    # returning a non-2xx, so the status alone does not prove a sign-in worked.
    if grep -q 'next-auth.session-token' "$JAR"; then
      pass "sign-in with seeded admin credentials issues a session cookie"
    else
      fail "sign-in with seeded admin credentials issues a session cookie" \
        "no session cookie after POST /api/auth/callback/credentials (HTTP $LOGIN_STATUS) — bcrypt, the user table or the NextAuth config is broken"
    fi

    expect_status_authed() { # <path> <codes> <label>
      local got
      got="$(http -b "$JAR" "$BASE$1")"
      if [[ ",$2," == *",$got,"* ]]; then
        pass "$3 ($got)"
      else
        fail "$3" "expected HTTP $2 from $1 as a signed-in admin, got ${got:-no response}"
      fi
    }

    expect_status_authed /admin 200 "signed-in admin reaches /admin"
    expect_status_authed /api/patients 200 "signed-in admin reads /api/patients"
    expect_status_authed /api/analytics/fields 200 "signed-in admin reads /api/analytics/fields"
  fi
  echo
fi

# --- Result ---------------------------------------------------------------
printf 'Smoke: %d passed, %d failed\n' "$PASSED" "$FAILED"
[[ "$FAILED" -eq 0 ]]
