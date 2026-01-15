import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ActivityType,
  REST,
  Routes,
  ChatInputCommandInteraction,
  ButtonInteraction,
  GuildMemberRoleManager,
} from "discord.js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath, pathToFileURL } from "url";

import "./server.js";

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error("❌ Missing DISCORD_TOKEN or CLIENT_ID in environment!");
  process.exit(1);
}

// Extend Client type
export interface BotClient extends Client {
  commands: Collection<string, any>;
  cmdChannelId?: string;
  adminRoles?: Set<string>;
}

const client: BotClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
}) as BotClient;

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
});

client.on(Events.Error, (error) => {
  console.error("❌ Discord client error:", error);
});

client.on(Events.Warn, (info) => {
  console.warn("⚠️ Discord client warning:", info);
});

client.commands = new Collection();

// Load commands dynamically
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cmdsPath = path.join(__dirname, "cmds");
const commandFiles = fs
  .readdirSync(cmdsPath)
  .filter(
    (file) =>
      (file.endsWith(".ts") && !file.endsWith(".d.ts")) ||
      (file.endsWith(".js") && !file.endsWith(".js.map")),
  );
const commandsData = [];

for (const file of commandFiles) {
  const filePath = path.join(cmdsPath, file);
  const command = (await import(pathToFileURL(filePath).href)).default;
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    commandsData.push(command.data.toJSON());
  } else {
    console.warn(`⚠️ Command ${file} missing "data" or "execute".`);
  }
}

// Register slash commands
const rest = new REST({ version: "10" }).setToken(token);
(async () => {
  try {
    console.log("🔁 Refreshing application commands...");
    await rest.put(Routes.applicationCommands(clientId), {
      body: commandsData,
    });
    console.log("✅ Commands registered globally!");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
})();

// Bot ready
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  for (const [, guild] of client.guilds.cache) {
    const me = guild.members.me;
    if (me) {
      try {
        await me.setNickname("ma");
        console.log(`📝 Updated nickname in guild: ${guild.name}`);
      } catch (err) {
        console.warn(`⚠️ Could not set nickname in ${guild.name}:`, err);
      }
    }
  }

  client.user?.setPresence({
    activities: [{ name: "sees you", type: ActivityType.Custom }],
    status: "online",
  });
});

// Interaction handler (buttons + slash commands)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // -------- BUTTON INTERACTIONS --------
    if (interaction.isButton()) {
      const buttonInteraction = interaction as ButtonInteraction;

      const [prefix, roleId] = buttonInteraction.customId.split("_");

      // Validate prefix and roleId
      if (prefix !== "getrole" || !roleId) {
        await buttonInteraction.reply({
          content: "❌ Invalid button ID.",
          flags: "Ephemeral",
        });

        return;
      }

      // Ensure this is used in a guild
      if (!buttonInteraction.guild) {
        await buttonInteraction.reply({
          content: "❌ This button can only be used in a server.",
          flags: "Ephemeral",
        });

        return;
      }

      // Get the role safely
      const role = buttonInteraction.guild.roles.cache.get(roleId);
      if (!role) {
        await buttonInteraction.reply({
          content: "❌ Role not found.",
          flags: "Ephemeral",
        });

        return;
      }

      // Ensure member has roles property
      if (!buttonInteraction.member || !("roles" in buttonInteraction.member)) {
        await buttonInteraction.reply({
          content: "❌ Cannot assign role.",
          flags: "Ephemeral",
        });

        return;
      }

      const memberRoles = buttonInteraction.member
        .roles as GuildMemberRoleManager;

      await buttonInteraction.deferReply({ ephemeral: true });
      await memberRoles.add(role);
      await buttonInteraction.editReply({
        content: `✅ You’ve been given the ${role.name} role!`,
      });

      return;
    }

    // -------- SLASH COMMANDS --------
    if (!interaction.isChatInputCommand()) return;
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const command = client.commands.get(chatInteraction.commandName);

    if (!command) {
      await chatInteraction.reply({
        content: "❌ Command not found.",
        flags: "Ephemeral",
      });

      return;
    }

    await command.execute(chatInteraction, client);
  } catch (error) {
    console.error("❌ Error handling interaction:", error);

    if (!interaction.isRepliable()) return;

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "❌ There was an error executing this interaction.",
          flags: "Ephemeral",
        });
      } else {
        await interaction.reply({
          content: "❌ There was an error executing this interaction.",
          flags: "Ephemeral",
        });
      }
    } catch (replyError) {
      // If the interaction is already expired/acknowledged, don't crash the process.
      console.error("⚠️ Failed to reply to interaction error:", replyError);
    }
  }
});

client.login(token);
