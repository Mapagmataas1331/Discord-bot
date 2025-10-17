import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { BotClient } from "../index";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency."),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    // Check if command channel is set
    if (client.cmdChannelId && interaction.channelId !== client.cmdChannelId) {
      return interaction.reply({
        content: "❌ You can only use this command in the command channel.",
        flags: "Ephemeral",
      });
    }

    await interaction.reply({ content: "🏓 Pinging..." });
    const sent = await interaction.fetchReply();
    const latency = (sent.createdTimestamp || 0) - interaction.createdTimestamp;
    await interaction.editReply(`🏓 Pong! Latency: ${latency}ms`);
  },
};
