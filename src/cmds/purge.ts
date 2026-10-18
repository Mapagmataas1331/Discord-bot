import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { logModAction } from "../lib/modlog.js";
import type { Command } from "../types.js";

const FOURTEEN_DAYS_MS = 14 * 86_400_000;

const purge: Command = {
  category: "moderation",
  anyChannel: true,
  requiredPermissions: PermissionFlagsBits.ManageMessages,
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete recent messages in this channel (max 100, newer than 14 days).")
    .addIntegerOption((opt) =>
      opt.setName("amount").setDescription("How many messages (1-100)").setMinValue(1).setMaxValue(100).setRequired(true),
    )
    .addUserOption((opt) => opt.setName("user").setDescription("Only delete messages from this user"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const channel = interaction.channel;
    const me = interaction.guild.members.me;
    if (!channel || !me) {
      await interaction.reply({ content: "❌ I can't access this channel.", flags: MessageFlags.Ephemeral });
      return;
    }
    const botPerms = channel.permissionsFor(me);
    if (!botPerms.has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) {
      await interaction.reply({
        content: "❌ I need **Manage Messages** and **Read Message History** in this channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    const user = interaction.options.getUser("user");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cutoff = Date.now() - FOURTEEN_DAYS_MS + 60_000; // small safety margin
    const fetched = await channel.messages.fetch({ limit: 100 });
    const candidates = fetched.filter((m) => !m.pinned && (!user || m.author.id === user.id));
    const recent = candidates.filter((m) => m.createdTimestamp > cutoff);
    const toDelete = [...recent.values()].slice(0, amount);
    const tooOld = Math.min(amount, candidates.size) - toDelete.length;

    if (toDelete.length === 0) {
      await interaction.editReply("ℹ️ No deletable messages found (messages older than 14 days can't be bulk-deleted).");
      return;
    }

    const deleted = await channel.bulkDelete(toDelete, true);
    await interaction.editReply(
      `🧹 Deleted **${deleted.size}** message(s)${user ? ` from ${user}` : ""}.` +
        (tooOld > 0 ? ` Skipped ${tooOld} older than 14 days.` : ""),
    );
    await logModAction(interaction.guild, {
      action: "Messages purged",
      moderator: interaction.user,
      target: user ?? undefined,
      details: `Deleted ${deleted.size} message(s) in ${channel}`,
      color: 0x5865f2,
    });
  },
};

export default purge;
