# Deployment (Oracle Cloud VM)

Files in this folder are installed on the server as follows (no secrets here; the token lives only in the server's `.env`):

| File | Installed to |
| --- | --- |
| `discord-bot.service` | `/etc/systemd/system/discord-bot.service` |
| `discord-bot-update.service` | `/etc/systemd/system/discord-bot-update.service` |
| `discord-bot-update.timer` | `/etc/systemd/system/discord-bot-update.timer` |
| `update.sh` | `/opt/discord-bot/update.sh` (owned by root, 755) |
| `remote-deploy.sh` | `/usr/local/sbin/discord-bot-deploy` (root, 755); forced command for the GitHub Actions deploy key |
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
journalctl -u discord-bot-update -n 50       # update logs (push deploys and timer)
systemctl list-timers discord-bot-update     # next update check
sudo systemctl start discord-bot-update      # update now instead of waiting
sudo systemctl restart discord-bot           # restart the bot
```

Updates: every push to `main` triggers `.github/workflows/deploy.yml`, which builds on GitHub and then starts the update
on the server over SSH; `discord-bot-update.timer` also checks hourly as a backup. Both run `update.sh` through
`discord-bot-update.service` (systemd runs one at a time, and `update.sh` also holds a `flock`).
`update.sh` fetches the tracked branch (`BRANCH`, default `main`).
If a new commit has landed, it resets to that commit, runs `pnpm install --frozen-lockfile`, builds into a
temporary folder and swaps it in, re-registers slash commands when `src/cmds/`, the deploy script or the
dependencies changed, and restarts the bot. If install or build fails, it rolls the code back, leaves the running bot alone,
exits non-zero, and the timer skips that commit until a newer one appears (a push deploy or manual re-run retries it).
To track a different branch, set `BRANCH=` at the top of `update.sh`, or add
`Environment=BRANCH=...` to `discord-bot-update.service`.

## Push deploys (GitHub Actions)

The deploy key is a dedicated ed25519 key whose public half is in `~ma/.ssh/authorized_keys` as

```
restrict,command="/usr/local/sbin/discord-bot-deploy" ssh-ed25519 AAAA... github-actions discord-bot deploy
```

`restrict` turns off the PTY and port/agent/X11 forwarding, and the forced command means the key can only start the update,
whatever command the client sends. Install the wrapper with
`sudo install -o root -g root -m 755 deploy/remote-deploy.sh /usr/local/sbin/discord-bot-deploy`.

Repository secrets (Settings → Secrets and variables → Actions):

| Name | Value |
| --- | --- |
| `ORACLE_HOST` | server hostname (`s.ma.cyou`) |
| `ORACLE_SSH_KEY` | the deploy private key (OpenSSH format) |
| `ORACLE_KNOWN_HOSTS` | the server's host key lines (`ssh-keyscan s.ma.cyou`, checked against `ssh-keygen -lf /etc/ssh/ssh_host_*_key.pub` on the server) |

To rotate the key, generate a new pair, replace the line in `authorized_keys`, and update `ORACLE_SSH_KEY`.
