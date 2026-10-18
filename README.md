# dc-bot

A community Discord bot built with **discord.js v14**, TypeScript and SQLite (Node's built-in `node:sqlite`).

## Features

- Slash commands only, guild-only, with a typed command registry (`src/cmds/index.ts`)
- Per-server settings stored in SQLite (survive restarts)
- Self-assign roles via buttons or dropdowns, with safety checks (no admin/mod-permission roles,
  no managed roles, nothing at or above the bot's own role); every click toggles the role
- Moderation: timeouts, purge, warnings with history, and a mod log channel
- Welcome message and auto-role for new members
- Music playback through a [Lavalink](https://lavalink.dev) v4 node: YouTube, Apple Music links, Vimeo, Twitch,
  Bandcamp and direct audio links, with a queue, loop, shuffle, seek, volume, an optional DJ role and auto-leave
- Native Discord polls and reminders that survive restarts
- `/help` generated from the command registry and filtered to what you can use

## Requirements

- Node.js **22.13 or newer** (`node:sqlite` is built in; no native build step, works on Windows and Linux ARM64)
- pnpm 10 (`corepack enable`)

## Setup

```bash
pnpm install
cp .env.example .env        # then fill in DISCORD_TOKEN and CLIENT_ID
pnpm build
pnpm deploy-commands        # register slash commands (re-run whenever commands change)
pnpm start
```

For development: `pnpm dev` runs `src/index.ts` with tsx in watch mode, and
`pnpm deploy-commands:dev` registers commands straight from the TypeScript sources.
Set `DEV_GUILD_ID` while developing: guild commands update instantly, while global ones can take a while.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token (Developer Portal → Bot). Never commit it. |
| `CLIENT_ID` | for `deploy-commands` | Application ID (Developer Portal → General Information). |
| `DEV_GUILD_ID` | no | If set, `deploy-commands` registers commands to this server only. Empty means global. |
| `PORT` | no | If set, starts a small HTTP keep-alive server (`/` and `/health`). Render sets this automatically. |
| `BOT_NICKNAME` | no | Nickname the bot sets for itself in every server on startup. Empty means no rename. |
| `GUILD_MEMBERS_INTENT` | no | `true` (default) requests the privileged Server Members intent for welcome messages and auto-role. Set `false` if you don't enable it in the portal. |
| `DB_PATH` | no | SQLite file path. Default `./data/bot.db`. On a server, point it at persistent storage. |
| `LAVALINK_HOST` | no | Lavalink host (default `127.0.0.1`). |
| `LAVALINK_PORT` | no | Lavalink port (default `2333`). |
| `LAVALINK_PASSWORD` | for music | Lavalink password. If unset, music commands reply "music unavailable" and everything else keeps working. |

## Gateway intents

| Intent | Privileged | Why |
| --- | --- | --- |
| `Guilds` | no | Servers, channels, roles, slash commands |
| `GuildVoiceStates` | no | Music: who is in which voice channel (join checks, auto-leave when alone) |
| `GuildMembers` | **yes** | Member-join events for the welcome message and auto-role |

Enable **Server Members Intent** under Developer Portal → your app → **Bot** → *Privileged Gateway Intents*.
If it isn't enabled, login fails with a clear message. Either enable it or set `GUILD_MEMBERS_INTENT=false`.
The Message Content intent is **not** needed.

## Invite and bot permissions

Invite with the `bot` and `applications.commands` scopes and these permissions:

- View Channels, Send Messages, Embed Links, Read Message History, Send Polls
- Manage Roles (role menus, `/getrole`, auto-role)
- Manage Messages (`/purge`)
- Moderate Members (`/timeout`)
- Change Nickname (only if you use `BOT_NICKNAME`)
- Connect and Speak (music)

Example URL (replace `CLIENT_ID`):
`https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=564049803832320`

Put the bot's role **above** every role it should hand out or time out (Server Settings → Roles).

## Commands

**General**
- `/help [command]`: list the commands you can use, or show details for one
- `/ping`: show bot latency
- `/rules`: show the community rules (EN/RU)

**Music** (you must be in the bot's voice channel; `/queue` and `/nowplaying` work from anywhere)
- `/play <query|url> [next]`: search YouTube (with autocomplete) or play a link or playlist; `next` puts it at the front
- `/pause`, `/resume`, `/skip [to]`, `/stop` (clear the queue and leave), `/leave`
- `/queue [page]`, `/nowplaying` (progress bar)
- `/volume <0-150>`, `/loop off|track|queue`, `/shuffle`, `/remove <position>`, `/seek <time>`
- If a DJ role is set (`/djrole`), only DJs, Manage Server, or someone alone with the bot can pause, skip, stop or change things.
- The bot leaves after 3 minutes alone in the channel or 3 minutes with an empty queue.

**Utility**
- `/userinfo [user]`: account and member details (moderators also see the warning count)
- `/serverinfo`: server statistics
- `/avatar [user] [global]`: full-size avatar
- `/poll <question> <answers> [hours] [multiple]`: native Discord poll. Separate answers with `;`
- `/remind me <in> <message>`, `/remind list`, `/remind cancel <id>`: reminders such as `10m`, `2h`, `1d12h`, kept across restarts
- `/watch <url>`: share a video with a preview. Discord doesn't let bots stream video, so this links to it or to Watch Together

**Moderation** (needs Discord permissions)
- `/timeout <member> <duration|off> [reason]`: time out for up to 28 days, or remove a timeout (Timeout Members)
- `/purge <amount> [user]`: bulk-delete up to 100 messages newer than 14 days (Manage Messages)
- `/warn <member> <reason>`: store a warning and DM the member (Timeout Members)
- `/warnings view|clear <user>`, `/warnings remove <id>`: view or clear warning history (Timeout Members)

**Admin** (Manage Server, or a role added with `/setadminroles`)
- `/settings`: show this server's settings
- `/setadminroles add|remove <role>`, `/setadminroles list`: choose which roles count as bot admins (Manage Server only)
- `/setcmdchannel set <channel>`, `/setcmdchannel clear`: restrict member commands to one channel (admins and moderation commands are exempt)
- `/modlog set <channel>`, `/modlog clear`: where moderation actions are logged
- `/djrole set <role>`, `/djrole clear`: require a DJ role for music controls
- `/welcome setup <channel> [message]`, `autorole <role>`, `disable`, `test`: welcome message and auto-role. Placeholders: `{user}`, `{username}`, `{server}`, `{memberCount}`, `{rules}` (the server rules channel). The default greeting is bilingual EN/RU
- `/getrole <role>`: post a single "I agree" button that toggles a role
- `/rolemenu <title> <role1> [style] [description] [role2..role10]`: post a self-assign menu with buttons or a dropdown

Admin commands set no `default_member_permissions`, so roles added with `/setadminroles` can see them.
The bot checks permission when a command runs. To hide admin commands from everyone else, use
Server Settings → Integrations → the bot. `/setadminroles` defaults to Manage Server, and the moderation
commands default to their matching Discord permission.

## Project layout

```
src/
  index.ts              client, event wiring, interaction routing
  deploy-commands.ts    registers slash commands (global or DEV_GUILD_ID)
  config.ts             environment variables
  server.ts             optional HTTP keep-alive
  types.ts              Command interface
  cmds/                 one file per command + index.ts registry
  handlers/             buttons, select menus, member join
  lib/                  db, settings, roles, permissions, warnings, reminders, mod log, durations, URL safety
  music/                Lavalink client setup, voice/DJ checks, embeds
```

## Adding a command

1. Create `src/cmds/mycommand.ts` exporting a `Command` (see `ping.ts`).
2. Add it to the list in `src/cmds/index.ts`.
3. Run `pnpm build && pnpm deploy-commands`.

## Deployment

Production runs on an Oracle Cloud Ubuntu 24.04 arm64 VM (Always Free A1) under systemd. Files and the full install steps are in [`deploy/`](deploy/README.md).

- Code: `/opt/discord-bot/app` (git checkout of `main`, owned by the `discordbot` system user)
- Secrets: `/opt/discord-bot/app/.env` (mode 600, never committed)
- Database: `/opt/discord-bot/data/bot.db` (`DB_PATH`)
- Service: `discord-bot.service` (node 22, `Restart=always`, `MemoryMax=512M`, hardened)
- Music: `lavalink.service` (Lavalink v4 on `127.0.0.1:2333`, `/opt/lavalink`). See [`deploy/lavalink/`](deploy/lavalink/README.md)
- Push deploys: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main` (and manually via *Run workflow*). It installs and builds on GitHub, then SSHes to the VM with a deploy key that can only run the update (forced command `/usr/local/sbin/discord-bot-deploy`). The run turns red if the server-side build, command registration or restart fails.
- Backup auto-update: `discord-bot-update.timer` also runs `/opt/discord-bot/update.sh` hourly. Both paths go through `discord-bot-update.service` and a lock, so they never run at the same time. When `main` changes it pulls, installs, builds, re-registers commands if needed, and restarts the bot.
- Repo secrets for the workflow: `ORACLE_HOST`, `ORACLE_SSH_KEY` (deploy private key), `ORACLE_KNOWN_HOSTS` (pinned server host keys). Optional variable `ORACLE_USER` (default `ma`).
- Logs: `journalctl -u discord-bot -f` (bot), `journalctl -u discord-bot-update` (updates)
