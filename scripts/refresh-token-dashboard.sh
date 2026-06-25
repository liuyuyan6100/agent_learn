#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${AGENT_LEARN_SOURCE_DIR:-/home/ubuntu/tool/agent_learn}"
DEPLOY_DIR="${AGENT_LEARN_DEPLOY_DIR:-/opt/agent-learn}"
RUN_USER="${AGENT_LEARN_RUN_USER:-ubuntu}"
LOCK_FILE="${AGENT_LEARN_REFRESH_LOCK_FILE:-/tmp/agent-learn-refresh.lock}"
STATE_DIR="${AGENT_LEARN_STATE_DIR:-/var/lib/agent-learn}"
TOKEN_DATA_FILE="data/token-usage.json"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "agent-learn refresh is already running"
  exit 0
fi

ensure_state_dir() {
  if [[ "$(id -u)" -eq 0 ]]; then
    install -d -m 0775 -o "$RUN_USER" -g "$RUN_USER" "$STATE_DIR"
    return
  fi

  if [[ -d "$STATE_DIR" && -w "$STATE_DIR" ]]; then
    return
  fi

  sudo -n /usr/bin/install -d -m 0775 -o "$RUN_USER" -g "$RUN_USER" "$STATE_DIR"
}

run_for_app_user() {
  if [[ "$(id -u)" -eq 0 ]]; then
    sudo -H -u "$RUN_USER" "$@"
  else
    "$@"
  fi
}

sync_token_data() {
  local source_file="$SOURCE_DIR/$TOKEN_DATA_FILE"
  local target_file="$DEPLOY_DIR/$TOKEN_DATA_FILE"
  local target_dir="${target_file%/*}"

  if [[ "$(id -u)" -eq 0 ]]; then
    install -d -m 0755 -o "$RUN_USER" -g "$RUN_USER" "$target_dir"
    install -m 0644 -o "$RUN_USER" -g "$RUN_USER" "$source_file" "$target_file"
  else
    sudo -n /usr/bin/install -d -m 0755 -o "$RUN_USER" -g "$RUN_USER" "$target_dir"
    sudo -n /usr/bin/install -m 0644 -o "$RUN_USER" -g "$RUN_USER" "$source_file" "$target_file"
  fi
}

echo "[$(date -Is)] ensuring state directory $STATE_DIR"
ensure_state_dir

echo "[$(date -Is)] collecting token usage"
run_for_app_user env \
  NEXT_TELEMETRY_DISABLED=1 \
  SOURCE_DIR="$SOURCE_DIR" \
  PATH="$PATH" \
  bash -lc 'cd "$SOURCE_DIR" && npm run collect:tokens -- --timezone Asia/Shanghai'

echo "[$(date -Is)] validating public data"
run_for_app_user env \
  NEXT_TELEMETRY_DISABLED=1 \
  SOURCE_DIR="$SOURCE_DIR" \
  PATH="$PATH" \
  bash -lc 'cd "$SOURCE_DIR" && npm run validate:data'

echo "[$(date -Is)] syncing $TOKEN_DATA_FILE to $DEPLOY_DIR"
sync_token_data

echo "[$(date -Is)] refresh complete"
