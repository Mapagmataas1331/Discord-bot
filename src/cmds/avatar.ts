import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";

const avatar: Command = {
  category: "utility",
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's avatar in full size.")
    .addUserOption((opt) => opt.setName("user").setDescription("User (defaults to you)"))
    .addBooleanOption((opt) => opt.setName("global").setDescription("Show the global avatar instead of the server one"))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = interaction.options.getMember("user") ?? (user.id === interaction.user.id ? interaction.member : null);
    const useGlobal = interaction.options.getBoolean("global") ?? false;

    const url =
      !useGlobal && member
        ? member.displayAvatarURL({ size: 1024, extension: "png", forceStatic: false })
        : user.displayAvatarURL({ size: 1024, extension: "png", forceStatic: false });

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ ${user.username}'s avatar`)
      .setURL(url)
      .setImage(url)
      .setColor(0x5865f2);
    await interaction.reply({ embeds: [embed] });
  },
};

export default avatar;
