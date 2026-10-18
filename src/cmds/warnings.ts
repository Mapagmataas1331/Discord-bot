import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { discordTime } from "../lib/duration.js";
import { logModAction } from "../lib/modlog.js";
import { clearWarnings, listWarnings, removeWarning } from "../lib/warnings.js";
import type { Command } from "../types.js";

const warnings: Command = {
  category: "moderation",
  anyChannel: true,
  requiredPermissions: PermissionFlagsBits.ModerateMembers,
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View or clear a member's warnings.")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Show a member's warnings.")
        .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Delete all warnings for a member.")
        .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Delete one warning by its number.")
        .addIntegerOption((opt) => opt.setName("id").setDescription("Warning number").setMinValue(1).setRequired(true)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);

    if (sub === "remove") {
      const id = interaction.options.getInteger("id", true);
      const removed = removeWarning(interaction.guildId, id);
      if (!removed) {
        await interaction.reply({ content: `❌ Warning #${id} not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({
        content: `🗑️ Removed warning #${id} for <@${removed.userId}>.`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      const target = await interaction.client.users.fetch(removed.userId).catch(() => undefined);
      await logModAction(interaction.guild, {
        action: "Warning removed",
        moderator: interaction.user,
        target,
        details: `Warning #${id}: ${removed.reason}`,
        color: 0x3ba55d,
      });
      return;
    }

    const user = interaction.options.getUser("user", true);

    if (sub === "clear") {
      const count = clearWarnings(interaction.guildId, user.id);
      await interaction.reply({
        content: `🗑️ Cleared ${count} warning(s) for ${user}.`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      if (count > 0) {
        await logModAction(interaction.guild, {
          action: "Warnings cleared",
          moderator: interaction.user,
          target: user,
          details: `${count} warning(s) removed`,
          color: 0x3ba55d,
        });
      }
      return;
    }

    const list = listWarnings(interaction.guildId, user.id);
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Warnings for ${user.tag}`)
      .setColor(0xf0b232)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(
        list.length === 0
          ? "No warnings. 🎉"
          : list
              .slice(0, 15)
              .map((w) => `**#${w.id}** · ${discordTime(w.createdAt, "f")} · by <@${w.moderatorId}>\n${w.reason}`)
              .join("\n\n") + (list.length > 15 ? `\n\n…and ${list.length - 15} more.` : ""),
      )
      .setFooter({ text: `${list.length} total` });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default warnings;
