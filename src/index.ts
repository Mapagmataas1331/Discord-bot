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
        return buttonInteraction.reply({
          content: "❌ Invalid button ID.",
          flags: "Ephemeral",
        });
      }

      // Ensure this is used in a guild
      if (!buttonInteraction.guild) {
        return buttonInteraction.reply({
          content: "❌ This button can only be used in a server.",
          flags: "Ephemeral",
        });
      }

      // Get the role safely
      const role = buttonInteraction.guild.roles.cache.get(roleId);
      if (!role) {
        return buttonInteraction.reply({
          content: "❌ Role not found.",
          flags: "Ephemeral",
        });
      }

      // Ensure member has roles property
      if (!buttonInteraction.member || !("roles" in buttonInteraction.member)) {
        return buttonInteraction.reply({
          content: "❌ Cannot assign role.",
          flags: "Ephemeral",
        });
      }

      const memberRoles = buttonInteraction.member
        .roles as GuildMemberRoleManager;
      await memberRoles.add(role);

      return buttonInteraction.reply({
        content: `✅ You’ve been given the ${role.name} role!`,
        flags: "Ephemeral",
      });
    }

    // -------- SLASH COMMANDS --------
    if (!interaction.isChatInputCommand()) return;
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const command = client.commands.get(chatInteraction.commandName);

    if (!command) {
      return chatInteraction.reply({
        content: "❌ Command not found.",
        flags: "Ephemeral",
      });
    }

    await command.execute(chatInteraction, client);
  } catch (error) {
    console.error("❌ Error handling interaction:", error);
    if (
      "isChatInputCommand" in interaction &&
      interaction.isChatInputCommand()
    ) {
      const chatInteraction = interaction as ChatInputCommandInteraction;
      if (chatInteraction.replied || chatInteraction.deferred) {
        await chatInteraction.followUp({
          content: "❌ There was an error executing this interaction.",
          flags: "Ephemeral",
        });
      } else {
        await chatInteraction.reply({
          content: "❌ There was an error executing this interaction.",
          flags: "Ephemeral",
        });
      }
    }
  }
});

client.login(token);
