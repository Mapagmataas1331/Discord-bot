# Deployment (Oracle Cloud VM)

Files in this folder are installed on the server as follows (no secrets here; the token lives only in the server's `.env`):

| File | Installed to |
| --- | --- |
| `discord-bot.service` | `/etc/systemd/system/discord-bot.service` |
| `discord-bot-update.service` | `/etc/systemd/system/discord-bot-update.service` |
| `discord-bot-update.timer` | `/etc/systemd/system/discord-bot-update.timer` |
| `update.sh` | `/opt/discord-bot/update.sh` (owned by root, 755) |
| `50-discord-bot-restart.rules` | `/etc/polkit-1/rules.d/50-discord-bot-restart.rules` |
| `lavalink/` | Lavalink audio node for music. See [`lavalink/README.md`](lavalink/README.md) |

## First-time install (Ubuntu 24.04, arm64)

```bash
# Node.js 22 LTS + pnpm (corepack)
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh && sudo bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs && sudo corepack enable

# User, code, data
sudo useradd --system --home-dir /opt/discord-bot --create-home --shell /usr/sbin/nologin discordbot
sudo chmod 750 /opt/discord-bot
sudo install -d -o discordbot -g discordbot -m 700 /opt/discord-bot/data
sudo -u discordbot -H git clone --branch main https://github.com/Mapagmataas1331/Discord-bot.git /opt/discord-bot/app
sudo -u discordbot -H bash -c 'cd /opt/discord-bot/app && pnpm install --frozen-lockfile && pnpm build'

# Secrets: copy your .env, then lock it down
sudo install -o discordbot -g discordbot -m 600 ./.env /opt/discord-bot/app/.env
#   It must contain DISCORD_TOKEN, CLIENT_ID and DB_PATH=/opt/discord-bot/data/bot.db, and must not set PORT.

# Units
sudo install -m 644 deploy/discord-bot.service deploy/discord-bot-update.service deploy/discord-bot-update.timer /etc/systemd/system/
sudo install -o root -g root -m 755 deploy/update.sh /opt/discord-bot/update.sh
sudo install -m 644 deploy/50-discord-bot-restart.rules /etc/polkit-1/rules.d/
sudo systemctl daemon-reload
sudo systemctl enable --now discord-bot.service discord-bot-update.timer
```

## Day to day

```bash
systemctl status discord-bot                 # is it running?
journalctl -u discord-bot -f                 # bot logs
journalctl -u discord-bot-update -n 50       # auto-update logs
systemctl list-timers discord-bot-update     # next update check
sudo systemctl start discord-bot-update      # update now instead of waiting
sudo systemctl restart discord-bot           # restart the bot
```

Auto-update: every 5 minutes `update.sh` fetches the tracked branch (`BRANCH`, default `main`).
If a new commit has landed, it resets to that commit, runs `pnpm install --frozen-lockfile`, builds into a
temporary folder and swaps it in, re-registers slash commands when `src/cmds/`, the deploy script or the
dependencies changed, and restarts the bot. If install or build fails, it rolls the code back, leaves the running bot alone,
and skips that commit until a newer one appears.
To track a different branch, set `BRANCH=` at the top of `update.sh`, or add
`Environment=BRANCH=...` to `discord-bot-update.service`.
