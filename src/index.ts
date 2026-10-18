import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { commandMap } from "./cmds/index.js";
import { config } from "./config.js";
import { closeDb, getDb } from "./lib/db.js";
import { handleMemberJoin } from "./handlers/memberJoin.js";
import { handleRoleButton } from "./handlers/roleButton.js";
import { ROLE_MENU_SELECT_ID, handleRoleSelect } from "./handlers/roleSelect.js";
import { isBotAdmin } from "./lib/permissions.js";
import { startReminderScheduler } from "./lib/reminders.js";
import { replyEphemeral } from "./lib/reply.js";
import { getSettings } from "./lib/settings.js";
import { setupMusic } from "./music/manager.js";
import { startKeepAlive } from "./server.js";

const { token } = config;
if (!token) {
  console.error("❌ Missing DISCORD_TOKEN in environment!");
  process.exit(1);
}

getDb(); // open + migrate up front so storage problems fail fast

if (config.port) startKeepAlive(config.port);

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates, // upcoming music support
];
// Privileged: enable "Server Members Intent" in the Developer Portal, or set GUILD_MEMBERS_INTENT=false.
if (config.guildMembersIntent) intents.push(GatewayIntentBits.GuildMembers);

const client = new Client({ intents });
setupMusic(client); // no-op (music commands reply "unavailable") when LAVALINK_PASSWORD is unset

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception, shutting down:", error);
  closeDb();
  process.exit(1); // let the process manager restart us in a clean state
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`👋 Received ${signal}, shutting down...`);
    void client.destroy().finally(() => {
      closeDb();
      process.exit(0);
    });
  });
}

client.on(Events.Error, (error) => console.error("❌ Discord client error:", error));
client.on(Events.Warn, (info) => console.warn("⚠️ Discord client warning:", info));

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag} (${c.guilds.cache.size} servers)`);

  if (config.botNickname) {
    for (const guild of c.guilds.cache.values()) {
      const me = guild.members.me;
      if (!me || me.nickname === config.botNickname) continue;
      try {
        await me.setNickname(config.botNickname);
      } catch (err) {
        console.warn(`⚠️ Could not set nickname in ${guild.name}:`, err);
      }
    }
  }

  startReminderScheduler(c);

  c.user.setPresence({
    activities: [{ name: "sees you", type: ActivityType.Custom }],
    status: "online",
  });
});

if (config.guildMembersIntent) {
  client.on(Events.GuildMemberAdd, (member) => {
    handleMemberJoin(member).catch((error: unknown) => console.error("❌ Member join handler failed:", error));
  });
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = commandMap.get(interaction.commandName);
  if (!command) {
    await replyEphemeral(interaction, "❌ Unknown command. It may have been removed.");
    return;
  }

  if (!interaction.inCachedGuild()) {
    await replyEphemeral(interaction, "❌ This command can only be used in a server.");
    return;
  }

  const admin = isBotAdmin(interaction.member);
  if (command.adminOnly && !admin) {
    await replyEphemeral(
      interaction,
      "❌ This is an admin command. You need Manage Server or a role added with `/setadminroles`.",
    );
    return;
  }

  if (command.requiredPermissions !== undefined && !interaction.memberPermissions.has(command.requiredPermissions)) {
    await replyEphemeral(interaction, "❌ You don't have permission to use this command.");
    return;
  }

  const { cmdChannelId } = getSettings(interaction.guildId);
  if (cmdChannelId && !command.anyChannel && !admin && interaction.channelId !== cmdChannelId) {
    await replyEphemeral(interaction, `❌ Please use bot commands in <#${cmdChannelId}>.`);
    return;
  }

  await command.execute(interaction);
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (!interaction.inCachedGuild()) return;
      const [prefix, roleId] = interaction.customId.split("_");
      if ((prefix === "getrole" || prefix === "rolemenu") && roleId) {
        await handleRoleButton(interaction, roleId);
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      if (!interaction.inCachedGuild()) return;
      const command = commandMap.get(interaction.commandName);
      await command?.autocomplete?.(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.inCachedGuild() && interaction.customId === ROLE_MENU_SELECT_ID) {
        await handleRoleSelect(interaction);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    }
  } catch (error) {
    console.error("❌ Error handling interaction:", error);
    if (!interaction.isRepliable()) return;
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "❌ Something went wrong while running that.",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "❌ Something went wrong while running that.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      console.error("⚠️ Failed to report interaction error:", replyError);
    }
  }
});

try {
  await client.login(token);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/disallowed intents/i.test(message)) {
    console.error(
      "❌ Discord rejected the requested intents. Enable \"Server Members Intent\" in the Developer Portal " +
        "(Bot → Privileged Gateway Intents), or set GUILD_MEMBERS_INTENT=false to run without welcome/auto-role.",
    );
  } else {
    console.error("❌ Login failed:", message);
  }
  closeDb();
  process.exit(1);
}
