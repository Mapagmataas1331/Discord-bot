import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import type { BotClient } from "../index";

export default {
  data: new SlashCommandBuilder()
    .setName("setcmdchannel")
    .setDescription("Set the channel where bot commands can be used.")
    .addChannelOption(opt => opt.setName("channel").setDescription("Select channel").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const channel = interaction.options.getChannel("channel");
    client.cmdChannelId = channel!.id;
    await interaction.reply(`✅ Command channel set to ${channel}`);
  },
};