#!/usr/bin/env bash
# Pulls the tracked branch, rebuilds, re-registers commands if needed, and restarts the bot.
# Runs as `discordbot` from discord-bot-update.service (timer: every 5 minutes). Logs go to the journal.
# A failed install/build never touches the running bot: code is rolled back and the service is not restarted.
set -euo pipefail

BRANCH="${BRANCH:-main}"            # branch to track
APP_DIR="${APP_DIR:-/opt/discord-bot/app}"
SERVICE="discord-bot.service"
STATE_DIR="/opt/discord-bot"
FAILED_MARK="$STATE_DIR/.update-failed"   # remembers a commit that failed to build, so we don't retry it every 5 min

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
log() { echo "[update] $*"; }

exec 9>"$STATE_DIR/.update.lock"
flock -n 9 || { log "another update is running; skipping"; exit 0; }

cd "$APP_DIR"
git fetch --quiet origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$LOCAL" == "$REMOTE" && "$CURRENT_BRANCH" == "$BRANCH" ]]; then
  log "up to date ($BRANCH @ ${LOCAL:0:7})"
  exit 0
fi
if [[ -f "$FAILED_MARK" && "$(cat "$FAILED_MARK")" == "$REMOTE" ]]; then
  log "origin/$BRANCH @ ${REMOTE:0:7} failed to build before; waiting for a new commit"
  exit 0
fi

log "updating $CURRENT_BRANCH @ ${LOCAL:0:7} -> $BRANCH @ ${REMOTE:0:7}"
CHANGED="$(git diff --name-only "$LOCAL" "$REMOTE" 2>/dev/null || echo "unknown")"

rollback() {
  log "ERROR: $1. Rolling back to ${LOCAL:0:7}; the running bot is left untouched."
  echo "$REMOTE" > "$FAILED_MARK"
  git checkout --quiet -f "$CURRENT_BRANCH" 2>/dev/null || true
  git reset --quiet --hard "$LOCAL"
  pnpm install --frozen-lockfile --reporter=silent || log "WARNING: restoring dependencies failed"
  rm -rf .dist-new
  exit 1
}

git checkout --quiet -f -B "$BRANCH" "origin/$BRANCH"
pnpm install --frozen-lockfile --reporter=silent || rollback "pnpm install failed"

# Build into a separate directory, then swap it in, so a failed build keeps the old dist/.
rm -rf .dist-new
pnpm exec tsc --outDir .dist-new || rollback "build failed"
rm -rf .dist-old
[[ -d dist ]] && mv dist .dist-old
mv .dist-new dist
rm -rf .dist-old
rm -f "$FAILED_MARK"

if [[ "$CHANGED" == "unknown" ]] || grep -qE '^(src/cmds/|src/deploy-commands\.ts|package\.json|pnpm-lock\.yaml)' <<<"$CHANGED"; then
  log "commands may have changed; re-registering slash commands"
  node dist/deploy-commands.js || log "WARNING: deploy-commands failed (bot will still restart)"
else
  log "no command changes; skipping deploy-commands"
fi

log "restarting $SERVICE"
systemctl restart "$SERVICE"
log "done: now at $BRANCH @ ${REMOTE:0:7}"
