import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { formatDuration, parseDuration } from "../lib/duration.js";
import { logModAction } from "../lib/modlog.js";
import { checkModerationTarget } from "../lib/permissions.js";
import type { Command } from "../types.js";

const MAX_TIMEOUT_MS = 28 * 86_400_000;

const timeout: Command = {
  category: "moderation",
  anyChannel: true,
  requiredPermissions: PermissionFlagsBits.ModerateMembers,
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Time out a member, or remove their timeout.")
    .addUserOption((opt) => opt.setName("member").setDescription("Member").setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName("duration")
        .setDescription('e.g. 10m, 1h, 1d (max 28d). Use "off" to remove the timeout.')
        .setRequired(true),
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getMember("member");
    if (!target) {
      await interaction.reply({ content: "❌ That user isn't in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const problem = checkModerationTarget(interaction.member, target);
    if (problem) {
      await interaction.reply({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!target.moderatable) {
      await interaction.reply({
        content: "❌ I can't time out that member (my role must be above theirs and I need Timeout Members).",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const reason = interaction.options.getString("reason");
    const rawDuration = interaction.options.getString("duration", true).trim().toLowerCase();
    const auditReason = `${interaction.user.tag}: ${reason ?? "no reason"}`;

    if (["off", "0", "none", "remove"].includes(rawDuration)) {
      await target.timeout(null, auditReason);
      await interaction.reply({ content: `✅ Removed the timeout from ${target}.`, allowedMentions: { parse: [] } });
      await logModAction(interaction.guild, {
        action: "Timeout removed",
        moderator: interaction.user,
        target: target.user,
        reason,
        color: 0x3ba55d,
      });
      return;
    }

    const ms = parseDuration(rawDuration);
    if (!ms || ms > MAX_TIMEOUT_MS) {
      await interaction.reply({
        content: "❌ Invalid duration. Use something like `10m`, `2h`, `1d` (max 28 days), or `off`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await target.timeout(ms, auditReason);
    await interaction.reply({
      content: `🔇 ${target} has been timed out for **${formatDuration(ms)}**.${reason ? ` Reason: ${reason}` : ""}`,
      allowedMentions: { parse: [] },
    });
    await logModAction(interaction.guild, {
      action: "Member timed out",
      moderator: interaction.user,
      target: target.user,
      reason,
      details: `Duration: ${formatDuration(ms)}`,
      color: 0xed4245,
    });
  },
};

export default timeout;
