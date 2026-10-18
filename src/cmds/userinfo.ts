import { EmbedBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { discordTime } from "../lib/duration.js";
import { countWarnings } from "../lib/warnings.js";
import type { Command } from "../types.js";

const userinfo: Command = {
  category: "utility",
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show information about a member.")
    .addUserOption((opt) => opt.setName("user").setDescription("User (defaults to you)"))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const user = await (interaction.options.getUser("user") ?? interaction.user).fetch();
    const member = interaction.options.getMember("user") ?? (user.id === interaction.user.id ? interaction.member : null);

    const embed = new EmbedBuilder()
      .setTitle(user.tag)
      .setThumbnail(member?.displayAvatarURL({ size: 256 }) ?? user.displayAvatarURL({ size: 256 }))
      .setColor(member?.displayColor || 0x5865f2)
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Bot", value: user.bot ? "Yes" : "No", inline: true },
        { name: "Account created", value: `${discordTime(user.createdTimestamp, "D")} (${discordTime(user.createdTimestamp)})` },
      );

    if (member) {
      if (member.joinedTimestamp) {
        embed.addFields({
          name: "Joined server",
          value: `${discordTime(member.joinedTimestamp, "D")} (${discordTime(member.joinedTimestamp)})`,
        });
      }
      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guildId)
        .sort((a, b) => b.position - a.position)
        .map((r) => `${r}`);
      embed.addFields({
        name: `Roles (${roles.length})`,
        value: roles.length > 0 ? roles.slice(0, 20).join(" ") + (roles.length > 20 ? " …" : "") : "None",
      });
      if (member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
        embed.addFields({ name: "Timed out until", value: discordTime(member.communicationDisabledUntilTimestamp, "f") });
      }
    } else {
      embed.setFooter({ text: "Not a member of this server" });
    }

    if (interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      embed.addFields({ name: "Warnings", value: String(countWarnings(interaction.guildId, user.id)), inline: true });
    }

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

export default userinfo;
