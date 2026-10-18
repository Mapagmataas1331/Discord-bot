#!/usr/bin/env bash
# Installs/updates Lavalink on Ubuntu (arm64 or x64). Run from this folder with sudo-capable user:
#   bash setup.sh [LAVALINK_VERSION]
# Generates a password on first install and writes it to /opt/lavalink/application.yml and the bot's .env.
set -euo pipefail
VERSION="${1:-4.2.2}"
BOT_ENV=/opt/discord-bot/app/.env
HERE="$(cd "$(dirname "$0")" && pwd)"

id lavalink >/dev/null 2>&1 || sudo useradd --system --home-dir /opt/lavalink --create-home --shell /usr/sbin/nologin lavalink
sudo chmod 750 /opt/lavalink
sudo install -d -o lavalink -g lavalink -m 750 /opt/lavalink/plugins /opt/lavalink/tmp

sudo curl -fsSL -o /opt/lavalink/Lavalink.jar.new "https://github.com/lavalink-devs/Lavalink/releases/download/${VERSION}/Lavalink.jar"
sudo mv /opt/lavalink/Lavalink.jar.new /opt/lavalink/Lavalink.jar
sudo chown lavalink:lavalink /opt/lavalink/Lavalink.jar

if ! sudo test -f /opt/lavalink/application.yml; then
  PASSWORD="$(openssl rand -hex 32)"
  TEMPLATE="$(cat "$HERE/application.yml.example")"
  # bash substitution + builtin printf keep the secret out of process arguments
  printf '%s\n' "${TEMPLATE//__LAVALINK_PASSWORD__/$PASSWORD}" | sudo tee /opt/lavalink/application.yml >/dev/null
  sudo chown lavalink:lavalink /opt/lavalink/application.yml
  sudo chmod 600 /opt/lavalink/application.yml
  if sudo test -f "$BOT_ENV"; then
    sudo sed -i -E '/^\s*LAVALINK_(HOST|PORT|PASSWORD)\s*=/d' "$BOT_ENV"
    printf 'LAVALINK_HOST=127.0.0.1\nLAVALINK_PORT=2333\nLAVALINK_PASSWORD=%s\n' "$PASSWORD" | sudo tee -a "$BOT_ENV" >/dev/null
    sudo chown discordbot:discordbot "$BOT_ENV" && sudo chmod 600 "$BOT_ENV"
  fi
  unset PASSWORD
fi

sudo install -m 644 "$HERE/lavalink.service" /etc/systemd/system/lavalink.service
sudo systemctl daemon-reload
sudo systemctl enable lavalink.service
sudo systemctl restart lavalink.service
echo "Lavalink ${VERSION} installed. Logs: journalctl -u lavalink -f"
