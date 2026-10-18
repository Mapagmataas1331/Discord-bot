import { ChannelType, EmbedBuilder, InteractionContextType, SlashCommandBuilder } from "discord.js";
import { discordTime } from "../lib/duration.js";
import type { Command } from "../types.js";

const serverinfo: Command = {
  category: "utility",
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show information about this server.")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = interaction.guild;
    const channels = guild.channels.cache;
    const count = (...types: ChannelType[]) => channels.filter((c) => types.includes(c.type)).size;

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setColor(0x5865f2)
      .addFields(
        { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "Members", value: String(guild.memberCount), inline: true },
        { name: "Created", value: `${discordTime(guild.createdTimestamp, "D")} (${discordTime(guild.createdTimestamp)})`, inline: true },
        {
          name: "Channels",
          value: `💬 ${count(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)} · 🔊 ${count(ChannelType.GuildVoice, ChannelType.GuildStageVoice)} · 📁 ${count(ChannelType.GuildCategory)}`,
          inline: true,
        },
        { name: "Roles", value: String(guild.roles.cache.size - 1), inline: true },
        { name: "Emojis", value: String(guild.emojis.cache.size), inline: true },
        { name: "Boosts", value: `${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`, inline: true },
      )
      .setFooter({ text: `ID: ${guild.id}` });
    const icon = guild.iconURL({ size: 256 });
    if (icon) embed.setThumbnail(icon);
    const banner = guild.bannerURL({ size: 1024 });
    if (banner) embed.setImage(banner);

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

export default serverinfo;
