#!/usr/bin/env bash
#
# Runs the same security scans CI runs, locally, so a finding is something you
# see before you push rather than a red pipeline afterwards.
#
#   npm run security
#
# gitleaks and semgrep are fetched on demand if they aren't installed; neither
# is a project dependency, because a security scanner that lives in the
# dependency tree it is scanning is a worse scanner.

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

GITLEAKS_VERSION="8.21.2"
FAILED=0

section() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }
note()    { printf '    %s\n' "$1"; }

# --- Secrets --------------------------------------------------------------
section "Secret scan (gitleaks, full git history)"
GITLEAKS_BIN="$(command -v gitleaks || true)"
if [[ -z "$GITLEAKS_BIN" ]]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) ASSET="gitleaks_${GITLEAKS_VERSION}_darwin_arm64.tar.gz" ;;
    Darwin-x86_64) ASSET="gitleaks_${GITLEAKS_VERSION}_darwin_x64.tar.gz" ;;
    Linux-x86_64) ASSET="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" ;;
    Linux-aarch64) ASSET="gitleaks_${GITLEAKS_VERSION}_linux_arm64.tar.gz" ;;
    *) ASSET="" ;;
  esac
  if [[ -n "$ASSET" ]]; then
    note "downloading gitleaks $GITLEAKS_VERSION"
    curl -fsSL -o /tmp/gitleaks.tar.gz \
      "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${ASSET}"
    tar -xzf /tmp/gitleaks.tar.gz -C /tmp gitleaks
    GITLEAKS_BIN=/tmp/gitleaks
  fi
fi

if [[ -n "$GITLEAKS_BIN" ]]; then
  "$GITLEAKS_BIN" detect --source . --config .gitleaks.toml --redact --no-banner || FAILED=1
else
  note "SKIPPED — no prebuilt gitleaks for $(uname -s)-$(uname -m); CI still runs it."
fi

# --- Static analysis ------------------------------------------------------
section "Static analysis (Semgrep)"
if command -v semgrep >/dev/null 2>&1; then
  semgrep \
    --config p/javascript \
    --config p/typescript \
    --config p/nextjs \
    --config p/secrets \
    --config p/sql-injection \
    --exclude node_modules \
    --exclude .next \
    --metrics=off \
    --error || FAILED=1
else
  note "SKIPPED — semgrep not installed. Install with: pip install semgrep"
fi

# --- Dependencies ---------------------------------------------------------
section "Dependency audit gate (production tree)"
node scripts/audit-gate.mjs || FAILED=1

section "Result"
if [[ "$FAILED" -eq 0 ]]; then
  note "All security scans passed."
else
  note "At least one scan failed — CI will fail on the same thing."
fi
exit "$FAILED"
