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
- `dev.lavalink.youtube:youtube-plugin` (replaces the deprecated built-in YouTube source). Clients: MUSIC, ANDROID_VR, TV, WEB, WEBEMBEDDED, TVHTML5_SIMPLY. OAuth is enabled (see below)
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

## YouTube OAuth (enabled)

Data-center IPs get "Sign in to confirm you're not a bot" / "This video requires login" errors, so the YouTube plugin
is signed in with a **burner Google account** (never a main account):

```yaml
plugins:
  youtube:
    clients: [MUSIC, ANDROID_VR, TV, WEB, WEBEMBEDDED, TVHTML5_SIMPLY]
    oauth:
      enabled: true
      refreshToken: "<stored on the server only>"
      skipInitialization: true
```

- OAuth is only used by the `TV` client, so `TV` must stay in `clients`.
- The refresh token lives only in `/opt/lavalink/application.yml` (mode 600, owner `lavalink`). Never put it in git.
- On start the log should show `YouTube access token refreshed successfully`.
- To redo it (token revoked or account changed): set `refreshToken` empty and `skipInitialization: false`, restart,
  open google.com/device and enter the code from `journalctl -u lavalink`. Then copy the refresh token from the journal into
  the config, set `skipInitialization: true` and restart. The token also stays in the journal (root-only); vacuum it if needed
  (`sudo journalctl --rotate && sudo journalctl --vacuum-time=1s`).

Test loading and streaming without printing the password (uses `$H` from the check above):

```bash
curl -s -H @"$H" "http://127.0.0.1:2333/v4/loadtracks?identifier=https://www.youtube.com/watch?v=VIDEO_ID" | head -c 300
curl -s -o /dev/null -w '%{http_code}\n' -H @"$H" "http://127.0.0.1:2333/youtube/stream/VIDEO_ID"
```

Status (2026-10-18): OAuth works and age/sign-in restricted videos now **load** (`loadtracks` OK), but the stream test for
some of them still fails (500/400) while normal videos stream fine. That points at signature deciphering for the WEB/TV
clients. If real `/play` also fails for those videos, the next step is a remote cipher server.

## Other fallbacks

1. **poToken + visitorData** (WEB/WEBEMBEDDED clients): generate them with iv-org's youtube-trusted-session-generator
   and set `plugins.youtube.pot.token` / `visitorData`.
2. **Remote cipher server** (`plugins.youtube.remoteCipher`, e.g. a self-hosted yt-cipher on 127.0.0.1) if signature
   deciphering breaks.

Keep these values in `application.yml` on the server only, never in git.
