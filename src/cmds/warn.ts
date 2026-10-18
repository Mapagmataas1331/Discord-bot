import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { logModAction } from "../lib/modlog.js";
import { checkModerationTarget } from "../lib/permissions.js";
import { addWarning, countWarnings } from "../lib/warnings.js";
import type { Command } from "../types.js";

const warn: Command = {
  category: "moderation",
  anyChannel: true,
  requiredPermissions: PermissionFlagsBits.ModerateMembers,
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member (stored in their warning history).")
    .addUserOption((opt) => opt.setName("member").setDescription("Member").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getMember("member");
    if (!target) {
      await interaction.reply({ content: "❌ That user isn't in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const problem = checkModerationTarget(interaction.member, target);
    if (problem || target.user.bot) {
      await interaction.reply({ content: `❌ ${problem ?? "Bots can't be warned."}`, flags: MessageFlags.Ephemeral });
      return;
    }

    const reason = interaction.options.getString("reason", true);
    const id = addWarning(interaction.guildId, target.id, interaction.user.id, reason);
    const total = countWarnings(interaction.guildId, target.id);

    const dmSent = await target
      .send(`⚠️ You were warned in **${interaction.guild.name}**: ${reason}`)
      .then(() => true)
      .catch(() => false);

    await interaction.reply({
      content:
        `⚠️ Warned ${target} (warning #${id}, ${total} total). Reason: ${reason}` +
        (dmSent ? "" : "\n_(Couldn't DM them: their DMs are closed.)_"),
      allowedMentions: { parse: [] },
    });
    await logModAction(interaction.guild, {
      action: "Member warned",
      moderator: interaction.user,
      target: target.user,
      reason,
      details: `Warning #${id} · ${total} total`,
      color: 0xf0b232,
    });
  },
};

export default warn;
