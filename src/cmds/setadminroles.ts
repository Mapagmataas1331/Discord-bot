import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { addAdminRole, getSettings, removeAdminRole } from "../lib/settings.js";
import type { Command } from "../types.js";

const setadminroles: Command = {
  category: "admin",
  anyChannel: true,
  data: new SlashCommandBuilder()
    .setName("setadminroles")
    .setDescription("Manage which roles can use the bot's admin commands.")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Allow a role to use admin commands.")
        .addRoleOption((opt) => opt.setName("role").setDescription("Role").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Stop a role from using admin commands.")
        .addRoleOption((opt) => opt.setName("role").setDescription("Role").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Show the current admin roles."))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    // Only real server managers may delegate bot-admin rights (prevents self-escalation).
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "❌ You need the **Manage Server** permission to change admin roles.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand(true);

    if (sub === "list") {
      const { adminRoleIds } = getSettings(interaction.guildId);
      const list = adminRoleIds.length > 0 ? adminRoleIds.map((id) => `<@&${id}>`).join(", ") : "none";
      await interaction.reply({
        content: `🛡️ Admin roles: ${list}\nMembers with **Manage Server** or **Administrator** are always bot admins.`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    const role = interaction.options.getRole("role", true);
    if (role.id === interaction.guildId) {
      await interaction.reply({ content: "❌ @everyone can't be an admin role.", flags: MessageFlags.Ephemeral });
      return;
    }

    const changed =
      sub === "add"
        ? addAdminRole(interaction.guildId, role.id)
        : removeAdminRole(interaction.guildId, role.id);
    const message =
      sub === "add"
        ? changed
          ? `✅ ${role} can now use admin commands.`
          : `ℹ️ ${role} is already an admin role.`
        : changed
          ? `✅ ${role} can no longer use admin commands.`
          : `ℹ️ ${role} was not an admin role.`;

    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  },
};

export default setadminroles;
