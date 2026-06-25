#!/usr/bin/env bash
set -euo pipefail

TARGET_FILE="${1:-/opt/agent-learn/.env.production}"
SECRET_SERVICE="${PLAN_SECRET_SERVICE:-agent-learn}"
DEFAULT_TTL="${PLAN_SESSION_TTL_SECONDS:-604800}"

if ! command -v dvp >/dev/null 2>&1; then
  echo "dvp command not found; cannot render plan auth env." >&2
  exit 1
fi

get_secret() {
  local key="$1"
  dvp secret get --full "$SECRET_SERVICE" "$key" 2>/dev/null
}

set_secret_from_stdin() {
  local key="$1"
  dvp secret set --from-stdin "$SECRET_SERVICE" "$key" >/dev/null
}

EMAILS="$(get_secret plan_access_emails || true)"
EMAIL="$(get_secret plan_access_email || true)"
LEGACY_USERNAME="$(get_secret plan_access_username || true)"
PASSWORD="$(get_secret plan_access_password || true)"
SESSION_SECRET="$(get_secret plan_session_secret || true)"
TRUST_CLOUDFLARE_ACCESS="$(get_secret plan_trust_cloudflare_access || true)"

if [ -z "$EMAILS" ] && [ -n "$EMAIL" ]; then
  EMAILS="$EMAIL"
fi

if [ -z "$EMAILS" ] && [ -z "$LEGACY_USERNAME" ] && [ "$TRUST_CLOUDFLARE_ACCESS" != "true" ]; then
  echo "Missing dvp secret: $SECRET_SERVICE/plan_access_emails or $SECRET_SERVICE/plan_access_email" >&2
  exit 1
fi

if [ -z "$PASSWORD" ] && [ "$TRUST_CLOUDFLARE_ACCESS" != "true" ]; then
  echo "Missing dvp secret: $SECRET_SERVICE/plan_access_password" >&2
  exit 1
fi

if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET="$(openssl rand -hex 32)"
  printf '%s' "$SESSION_SECRET" | set_secret_from_stdin plan_session_secret
fi

mkdir -p "$(dirname "$TARGET_FILE")"
umask 077
{
  if [ -n "$EMAILS" ]; then
    printf 'PLAN_ACCESS_EMAILS=%s\n' "$EMAILS"
  fi
  if [ -n "$LEGACY_USERNAME" ]; then
    printf 'PLAN_ACCESS_USERNAME=%s\n' "$LEGACY_USERNAME"
  fi
  if [ -n "$PASSWORD" ]; then
    printf 'PLAN_ACCESS_PASSWORD=%s\n' "$PASSWORD"
  fi
  if [ -n "$TRUST_CLOUDFLARE_ACCESS" ]; then
    printf 'PLAN_TRUST_CLOUDFLARE_ACCESS=%s\n' "$TRUST_CLOUDFLARE_ACCESS"
  fi
  printf 'PLAN_SESSION_SECRET=%s\n' "$SESSION_SECRET"
  printf 'PLAN_SESSION_TTL_SECONDS=%s\n' "$DEFAULT_TTL"
} > "$TARGET_FILE"
chmod 600 "$TARGET_FILE"

echo "Rendered plan auth env: $TARGET_FILE"
