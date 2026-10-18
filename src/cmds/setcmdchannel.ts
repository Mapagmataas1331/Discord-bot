import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { setCmdChannel } from "../lib/settings.js";
import type { Command } from "../types.js";

const setcmdchannel: Command = {
  category: "admin",
  adminOnly: true,
  anyChannel: true,
  data: new SlashCommandBuilder()
    .setName("setcmdchannel")
    .setDescription("Restrict member commands to one channel (admins are exempt).")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the command channel.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Text channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName("clear").setDescription("Allow commands in every channel again."))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (interaction.options.getSubcommand(true) === "clear") {
      setCmdChannel(interaction.guildId, null);
      await interaction.reply({ content: "✅ Commands can be used in any channel again.", flags: MessageFlags.Ephemeral });
      return;
    }

    const channel = interaction.options.getChannel("channel", true, [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
    ]);
    setCmdChannel(interaction.guildId, channel.id);
    await interaction.reply({ content: `✅ Command channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  },
};

export default setcmdchannel;
