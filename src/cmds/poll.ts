import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";

const poll: Command = {
  category: "utility",
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a native Discord poll.")
    .addStringOption((opt) => opt.setName("question").setDescription("The question").setRequired(true).setMaxLength(300))
    .addStringOption((opt) =>
      opt.setName("answers").setDescription('2-10 answers separated by ";" e.g. "Pizza; Sushi; Tacos"').setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt.setName("hours").setDescription("How long the poll runs (1-768 hours, default 24)").setMinValue(1).setMaxValue(768),
    )
    .addBooleanOption((opt) => opt.setName("multiple").setDescription("Allow picking more than one answer"))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const question = interaction.options.getString("question", true);
    const answers = interaction.options
      .getString("answers", true)
      .split(/[;|]/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (answers.length < 2 || answers.length > 10) {
      await interaction.reply({
        content: '❌ Give between 2 and 10 answers, separated by `;` (e.g. `Pizza; Sushi; Tacos`).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const tooLong = answers.find((a) => a.length > 55);
    if (tooLong) {
      await interaction.reply({ content: `❌ Answers can be at most 55 characters: "${tooLong.slice(0, 60)}…"`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({
      poll: {
        question: { text: question },
        answers: answers.map((text) => ({ text })),
        duration: interaction.options.getInteger("hours") ?? 24,
        allowMultiselect: interaction.options.getBoolean("multiple") ?? false,
      },
    });
  },
};

export default poll;
