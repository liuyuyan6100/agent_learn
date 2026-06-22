#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${AGENT_LEARN_SOURCE_DIR:-/home/ubuntu/tool/agent_learn}"
DEPLOY_DIR="${AGENT_LEARN_DEPLOY_DIR:-/opt/agent-learn}"
APP_SERVICE="${AGENT_LEARN_APP_SERVICE:-agent-learn.service}"
RUN_USER="${AGENT_LEARN_RUN_USER:-ubuntu}"
LOCK_FILE="${AGENT_LEARN_REFRESH_LOCK_FILE:-/tmp/agent-learn-refresh.lock}"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "agent-learn refresh is already running"
  exit 0
fi

run_for_app_user() {
  if [[ "$(id -u)" -eq 0 ]]; then
    sudo -H -u "$RUN_USER" "$@"
  else
    "$@"
  fi
}

restart_app() {
  if [[ "$(id -u)" -eq 0 ]]; then
    systemctl restart "$APP_SERVICE"
  else
    sudo -n /usr/bin/systemctl restart "$APP_SERVICE"
  fi
}

echo "[$(date -Is)] collecting token usage"
run_for_app_user env \
  NEXT_TELEMETRY_DISABLED=1 \
  SOURCE_DIR="$SOURCE_DIR" \
  PATH="$PATH" \
  bash -lc 'cd "$SOURCE_DIR" && npm run collect:tokens -- --timezone Asia/Shanghai'

echo "[$(date -Is)] validating and building"
run_for_app_user env \
  NEXT_TELEMETRY_DISABLED=1 \
  SOURCE_DIR="$SOURCE_DIR" \
  PATH="$PATH" \
  bash -lc 'cd "$SOURCE_DIR" && npm run verify'

echo "[$(date -Is)] syncing build to $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
chown "$RUN_USER:$RUN_USER" "$DEPLOY_DIR"
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/cache/' \
  "$SOURCE_DIR"/ "$DEPLOY_DIR"/

echo "[$(date -Is)] restarting $APP_SERVICE"
restart_app

echo "[$(date -Is)] refresh complete"
