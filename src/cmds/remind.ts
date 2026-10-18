import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { discordTime, formatDuration, parseDuration } from "../lib/duration.js";
import {
  MAX_REMINDERS_PER_USER,
  addReminder,
  cancelReminder,
  countReminders,
  listReminders,
} from "../lib/reminders.js";
import type { Command } from "../types.js";

const MAX_DELAY_MS = 365 * 86_400_000;

const remind: Command = {
  category: "utility",
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Set reminders (they survive bot restarts).")
    .addSubcommand((sub) =>
      sub
        .setName("me")
        .setDescription("Remind me about something.")
        .addStringOption((opt) => opt.setName("in").setDescription("When, e.g. 10m, 2h, 1d12h, 1w").setRequired(true))
        .addStringOption((opt) => opt.setName("message").setDescription("What to remind you about").setRequired(true).setMaxLength(1000)),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Show your pending reminders."))
    .addSubcommand((sub) =>
      sub
        .setName("cancel")
        .setDescription("Cancel a reminder.")
        .addIntegerOption((opt) => opt.setName("id").setDescription("Reminder number from /remind list").setRequired(true)),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);

    if (sub === "list") {
      const list = listReminders(interaction.guildId, interaction.user.id);
      await interaction.reply({
        content:
          list.length === 0
            ? "You have no pending reminders."
            : list.map((r) => `**#${r.id}** · ${discordTime(r.dueAt)} · ${r.message.slice(0, 100)}`).join("\n"),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (sub === "cancel") {
      const id = interaction.options.getInteger("id", true);
      const ok = cancelReminder(id, interaction.guildId, interaction.user.id);
      await interaction.reply({
        content: ok ? `🗑️ Cancelled reminder #${id}.` : `❌ You have no reminder #${id} here.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const delay = parseDuration(interaction.options.getString("in", true));
    if (!delay || delay < 10_000 || delay > MAX_DELAY_MS) {
      await interaction.reply({
        content: "❌ Use a duration like `10m`, `2h`, `1d12h` (between 10 seconds and 365 days).",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (countReminders(interaction.guildId, interaction.user.id) >= MAX_REMINDERS_PER_USER) {
      await interaction.reply({
        content: `❌ You already have ${MAX_REMINDERS_PER_USER} pending reminders. Cancel some first.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const dueAt = Date.now() + delay;
    const id = addReminder({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      message: interaction.options.getString("message", true),
      dueAt,
    });
    await interaction.reply({
      content: `⏰ Reminder #${id} set for ${discordTime(dueAt)} (in ${formatDuration(delay)}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default remind;
