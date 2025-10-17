# Discord Bot - dc-bot

## Overview
This is a Discord bot built with TypeScript and discord.js that provides community management features including role assignment, rules display, and administrative controls. The bot supports bilingual content (English and Russian) and uses slash commands for all interactions.

**Current State**: ✅ Fully operational and connected to Discord

## Recent Changes
- **October 17, 2025**: Initial Replit setup completed
  - Fixed module path resolution for ES modules
  - Updated file filtering to exclude TypeScript declaration files
  - Configured workflow to run the compiled bot
  - Bot successfully connected and commands registered

## Project Architecture

### Technology Stack
- **Language**: TypeScript (ES2022)
- **Runtime**: Node.js 20
- **Package Manager**: npm (originally pnpm)
- **Main Library**: discord.js v14
- **Module System**: ESNext (ES Modules)

### Project Structure
```
.
├── src/
│   ├── index.ts              # Main bot entry point
│   └── cmds/                 # Slash commands directory
│       ├── getrole.ts        # Role assignment with button
│       ├── ping.ts           # Latency check
│       ├── rules.ts          # Display community rules
│       ├── setadminroles.ts  # Configure admin roles
│       └── setcmdchannel.ts  # Set command channel
├── dist/                     # Compiled JavaScript output
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── .env                     # Environment variables (not in repo)
```

### Key Features
1. **Dynamic Command Loading**: Commands are automatically loaded from the `cmds` directory
2. **Role Management**: Button-based role assignment system
3. **Channel Restrictions**: Optional command channel enforcement
4. **Bilingual Support**: English and Russian language support
5. **Admin Controls**: Role and channel configuration commands

## Bot Commands

### User Commands
- `/ping` - Check bot latency and response time
- `/rules` - Display community rules in both English and Russian

### Admin Commands (Require Administrator Permission)
- `/getrole <role>` - Create a button that assigns a role when clicked
- `/setadminroles <role>` - Designate roles with admin privileges
- `/setcmdchannel <channel>` - Set the channel where commands can be used

## Environment Variables

Required secrets (already configured in Replit):
- `DISCORD_TOKEN` - Bot authentication token from Discord Developer Portal
- `CLIENT_ID` - Discord application client ID

## Development

### Build Commands
```bash
npm run build    # Compile TypeScript to JavaScript
npm start        # Run the compiled bot
npm run dev      # Run with ts-node (development mode)
```

### Workflow
The bot runs automatically via the "Discord Bot" workflow:
- Command: `npm start`
- Output: Console logs
- Status: Should show "RUNNING" when active

### How It Works
1. Bot loads environment variables from Replit Secrets
2. Dynamically imports all command files from the compiled `dist/cmds` directory
3. Registers slash commands globally with Discord
4. Connects to Discord and sets presence status
5. Listens for slash command and button interactions

## Important Notes

### Module Path Resolution
The bot uses ES modules and requires special handling:
- Uses `fileURLToPath` and `import.meta.url` to resolve paths
- Filters out `.d.ts` declaration files when loading commands
- Commands must be in the same directory structure in both `src` and `dist`

### Discord Setup
To use this bot:
1. Create an application at https://discord.com/developers/applications
2. Create a bot user in the "Bot" section
3. Enable required intents: Guilds, Guild Messages, Message Content
4. Invite bot to your server with proper permissions (Administrator recommended)
5. Provide DISCORD_TOKEN and CLIENT_ID in Replit Secrets

### Bot Behavior
- Automatically sets nickname to "ma" when joining guilds
- Custom presence: "sees you" (Custom activity)
- Registers commands globally (may take up to 1 hour to propagate)

## Troubleshooting

### Bot Not Responding
1. Check workflow status in Replit (should be RUNNING)
2. Verify Discord credentials in Secrets
3. Check console logs for error messages
4. Ensure bot has proper permissions in Discord server

### Commands Not Appearing
- Global commands can take up to 1 hour to register
- Try using guild-specific commands for faster testing (requires code modification)

### Build Errors
- Run `npm run build` to check for TypeScript errors
- Ensure all dependencies are installed with `npm install`

## User Preferences
- No specific preferences documented yet
