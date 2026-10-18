import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { config } from "../config.js";
import { DEFAULT_WELCOME_MESSAGE, renderWelcome } from "../handlers/memberJoin.js";
import { checkAssignableRole } from "../lib/roles.js";
import { getSettings, setSetting } from "../lib/settings.js";
import type { Command } from "../types.js";

const welcome: Command = {
  category: "admin",
  adminOnly: true,
  anyChannel: true,
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure the welcome message and auto-role for new members.")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set the welcome channel and (optionally) the message.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Where to greet new members")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Placeholders: {user} {username} {server} {memberCount} {rules}")
            .setMaxLength(1500),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("autorole")
        .setDescription("Give new members a role automatically.")
        .addRoleOption((opt) => opt.setName("role").setDescription("Role").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Turn off the welcome message or the auto-role.")
        .addStringOption((opt) =>
          opt
            .setName("what")
            .setDescription("What to disable")
            .setRequired(true)
            .addChoices({ name: "Welcome message", value: "message" }, { name: "Auto-role", value: "autorole" }),
        ),
    )
    .addSubcommand((sub) => sub.setName("test").setDescription("Preview the welcome message using yourself."))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);
    const intentNote = config.guildMembersIntent
      ? ""
      : "\n⚠️ GUILD_MEMBERS_INTENT is off, so join events are not received. Enable the Server Members intent and the env flag.";

    if (sub === "setup") {
      const channel = interaction.options.getChannel("channel", true, [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
      ]);
      const me = interaction.guild.members.me;
      if (me && !channel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
        await interaction.reply({ content: `❌ I can't send messages in ${channel}.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const message = interaction.options.getString("message");
      setSetting(interaction.guildId, "welcomeChannelId", channel.id);
      if (message) setSetting(interaction.guildId, "welcomeMessage", message);
      await interaction.reply({
        content: `✅ New members will be welcomed in ${channel}. Try \`/welcome test\`.${intentNote}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "autorole") {
      const role = interaction.options.getRole("role", true);
      const problem = checkAssignableRole(role);
      if (problem) {
        await interaction.reply({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
        return;
      }
      setSetting(interaction.guildId, "autoRoleId", role.id);
      await interaction.reply({
        content: `✅ New members will get ${role}.${intentNote}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (sub === "disable") {
      const what = interaction.options.getString("what", true);
      if (what === "autorole") {
        setSetting(interaction.guildId, "autoRoleId", null);
      } else {
        setSetting(interaction.guildId, "welcomeChannelId", null);
      }
      await interaction.reply({
        content: `✅ ${what === "autorole" ? "Auto-role" : "Welcome message"} disabled.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settings = getSettings(interaction.guildId);
    await interaction.reply({
      content:
        `**Preview** (channel: ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "not set"}):\n\n` +
        renderWelcome(settings.welcomeMessage ?? DEFAULT_WELCOME_MESSAGE, interaction.member) +
        intentNote,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};

export default welcome;
