#!/usr/bin/env bash
# Forced command for the GitHub Actions deploy key. Installed to /usr/local/sbin/discord-bot-deploy (root, 755) and
# referenced from ~ma/.ssh/authorized_keys as:
#   restrict,command="/usr/local/sbin/discord-bot-deploy" ssh-ed25519 AAAA... github-actions discord-bot deploy
# Whatever command the client asks for ($SSH_ORIGINAL_COMMAND) is ignored: this key can only run the bot update.
set -uo pipefail
UNIT="discord-bot-update.service"

if [[ -n "${SSH_ORIGINAL_COMMAND:-}" && "${SSH_ORIGINAL_COMMAND}" != "deploy" ]]; then
  echo "[deploy] ignoring the requested command; this key can only run the bot update"
fi

# A push or manual re-run should retry a commit that failed before (the hourly timer skips those).
sudo -n -u discordbot rm -f /opt/discord-bot/.update-failed

# systemd runs one update at a time: if the timer's run is in progress, this waits for it and reports its result.
sudo -n systemctl start "$UNIT"
rc=$?

id="$(systemctl show -p InvocationID --value "$UNIT")"
[[ -n "$id" ]] && sudo -n journalctl --no-pager -o cat "_SYSTEMD_INVOCATION_ID=$id"
if [[ $rc -ne 0 ]]; then
  echo "[deploy] update failed (exit $rc). Details: journalctl -u $UNIT"
fi
exit "$rc"
