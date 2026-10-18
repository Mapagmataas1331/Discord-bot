import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";

const ping: Command = {
  category: "general",
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency.")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.deferReply();
    const sent = await interaction.fetchReply();
    const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
    const gateway = interaction.client.ws.ping;
    await interaction.editReply(
      `🏓 Pong! Round-trip: ${roundTrip}ms · Gateway: ${gateway >= 0 ? `${gateway}ms` : "n/a"}`,
    );
  },
};

export default ping;
