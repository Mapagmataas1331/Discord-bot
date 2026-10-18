# Lavalink (music backend)

The bot plays music through a local [Lavalink](https://github.com/lavalink-devs/Lavalink) v4 node.

| What | Where |
| --- | --- |
| Jar | `/opt/lavalink/Lavalink.jar` (v4.2.2) |
| Config | `/opt/lavalink/application.yml` (mode 600; contains the password) |
| Plugins | `/opt/lavalink/plugins/` (downloaded automatically on start) |
| Service | `lavalink.service` (user `lavalink`, `-Xmx768m`, `MemoryMax=1G`) |
| Listens on | `127.0.0.1:2333` only (no inbound firewall rule needed) |
| Java | system `java` (Ubuntu openjdk-25, shared with Minecraft) |

Plugins:
- `dev.lavalink.youtube:youtube-plugin` (replaces the deprecated built-in YouTube source). Clients: MUSIC, ANDROID_VR, WEB, WEBEMBEDDED, TVHTML5_SIMPLY
- `com.github.topi314.lavasrc:lavasrc-plugin`: Apple Music links and search, mirrored to YouTube. Spotify and Deezer stay disabled because they need API credentials

Other sources: Vimeo, Twitch, Bandcamp and HTTP are enabled; local files are disabled. SoundCloud is enabled, but with Lavalink 4.2.2
(lavaplayer 2.2.6) it currently fails with "Did not detect any supported formats", so treat it as broken until a Lavalink update.

## Install / update

```bash
cd deploy/lavalink
bash setup.sh 4.2.2        # creates user, downloads the jar, installs the unit, starts it
```

On first install, `setup.sh` generates a random password and writes it to `application.yml` and to the bot's `.env`
(`LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`). Then restart the bot: `sudo systemctl restart discord-bot`.
Re-running it later only updates the jar and unit, and keeps the existing config.

## Checks

```bash
systemctl status lavalink
journalctl -u lavalink -f
# REST check without printing the password:
H=$(mktemp); printf 'Authorization: %s\n' "$(sudo awk '/^\s*password:/{gsub(/"/,"",$2);print $2;exit}' /opt/lavalink/application.yml)" > "$H"
curl -s -H @"$H" http://127.0.0.1:2333/v4/info; rm -f "$H"
```

## If YouTube starts blocking the server

Data-center IPs sometimes get "Sign in to confirm you're not a bot" errors. Fixes, in order of preference:

1. **OAuth with a burner Google account (never your main one):** set `plugins.youtube.oauth.enabled: true`, restart, and follow the
   device-code prompt in `journalctl -u lavalink` (open google.com/device and enter the code). The log then prints a refresh token.
   Put it in `oauth.refreshToken` and set `skipInitialization: true`. OAuth playback goes through the `TV` client, so add `TV` to `clients`.
2. **poToken + visitorData** (WEB/WEBEMBEDDED clients): generate them with iv-org's youtube-trusted-session-generator
   and set `plugins.youtube.pot.token` / `visitorData`.
3. A remote cipher server (`plugins.youtube.remoteCipher`) if signature deciphering breaks.

Keep these values in `application.yml` on the server only, never in git.
