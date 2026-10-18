/**
 * Registers slash commands with Discord. Run after adding/changing commands:
 *   pnpm build && pnpm deploy-commands      (or: pnpm deploy-commands:dev)
 * With DEV_GUILD_ID set, commands are registered to that server only (instant);
 * otherwise globally (can take a few minutes to show up).
 */
import { REST, Routes } from "discord.js";
import { commands } from "./cmds/index.js";
import { config } from "./config.js";

const { token, clientId, devGuildId } = config;
if (!token || !clientId) {
  console.error("❌ DISCORD_TOKEN and CLIENT_ID must be set to deploy commands.");
  process.exit(1);
}

const body = commands.map((command) => command.data.toJSON());
const rest = new REST({ version: "10" }).setToken(token);

try {
  const route = devGuildId
    ? Routes.applicationGuildCommands(clientId, devGuildId)
    : Routes.applicationCommands(clientId);
  console.log(`🔁 Registering ${body.length} commands ${devGuildId ? `to guild ${devGuildId}` : "globally"}...`);
  await rest.put(route, { body });
  console.log("✅ Commands registered.");
} catch (error) {
  console.error("❌ Failed to register commands:", error);
  process.exit(1);
}
