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
- `dev.lavalink.youtube:youtube-plugin` (replaces the deprecated built-in YouTube source). Currently a **master snapshot**
  (`2be8e542`, `snapshot: true`) because the TV-client fix (upstream issue #226) isn't in a release yet; switch back to a
  release newer than 1.18.2 once one exists. Clients: MUSIC, ANDROID_VR, TV, WEB, WEBEMBEDDED, TVHTML5_SIMPLY. OAuth is enabled (see below)
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
H=$(mktemp); printf 'Authorization: %s\n' "$(sudo awk '/^    password:/{gsub(/"/,"",$2);print $2;exit}' /opt/lavalink/application.yml)" > "$H"
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

Status (2026-10-18): fixed. Sign-in-only videos (e.g. madk1d) failed with `TVHTML5: The page needs to be reloaded`
and `Must find sig function`. Two changes fixed it: the youtube-plugin master snapshot (new TV User-Agent) and the local
yt-cipher server below. `/youtube/stream/<id>` now returns audio for them (the `?withClient=TV` variant of that test route
still answers 400, which is expected for that debug route; confirm with a real `/play`).

## yt-cipher (remote signature solver)

YouTube's player scripts change often and the plugin's built-in cipher breaks (`Must find sig function`). A local
[yt-cipher](https://github.com/kikkia/yt-cipher) solves them instead:

- Binary `/opt/yt-cipher/server` (single file built with `deno compile --target aarch64-unknown-linux-gnu` from the
  yt-cipher repo + yt-dlp/ejs at the commit its Dockerfile pins; build it on another machine, not on the server).
- Unit `yt-cipher.service` (this folder): user `ytcipher`, `127.0.0.1:8001` only, `MAX_THREADS=1`, `MemoryMax=384M`, `CPUQuota=50%`.
- `/opt/yt-cipher/env` (root:ytcipher 640) holds `API_TOKEN`; the same value is `plugins.youtube.remoteCipher.password`
  in `application.yml`, with `url: "http://127.0.0.1:8001"`.
- Check: `systemctl status yt-cipher`, and Lavalink logs `Using remote cipher server with URL "http://127.0.0.1:8001"` on start.

## Other fallbacks

1. **poToken + visitorData** (WEB/WEBEMBEDDED clients): generate them with iv-org's youtube-trusted-session-generator
   and set `plugins.youtube.pot.token` / `visitorData`.

Keep these values in `application.yml` on the server only, never in git.
