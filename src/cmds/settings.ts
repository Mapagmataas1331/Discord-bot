import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DEFAULT_WELCOME_MESSAGE } from "../handlers/memberJoin.js";
import { getSettings } from "../lib/settings.js";
import type { Command } from "../types.js";

const channel = (id: string | null) => (id ? `<#${id}>` : "—");
const role = (id: string | null) => (id ? `<@&${id}>` : "—");

const settings: Command = {
  category: "admin",
  adminOnly: true,
  anyChannel: true,
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Show this server's bot settings.")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const s = getSettings(interaction.guildId);
    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Settings for ${interaction.guild.name}`)
      .setColor(0x5865f2)
      .addFields(
        { name: "Command channel", value: channel(s.cmdChannelId), inline: true },
        { name: "Mod log", value: channel(s.modLogChannelId), inline: true },
        {
          name: "Admin roles",
          value: s.adminRoleIds.length > 0 ? s.adminRoleIds.map((id) => role(id)).join(", ") : "— (Manage Server only)",
        },
        { name: "Welcome channel", value: channel(s.welcomeChannelId), inline: true },
        { name: "Auto-role", value: role(s.autoRoleId), inline: true },
        { name: "DJ role", value: role(s.djRoleId), inline: true },
        { name: "Gate channel", value: channel(s.gateChannelId), inline: true },
        { name: "Member role", value: role(s.memberRoleId), inline: true },
        { name: "Inner role (replaces Member)", value: role(s.innerRoleId), inline: true },
        { name: "Welcome message", value: (s.welcomeMessage ?? `${DEFAULT_WELCOME_MESSAGE} _(default)_`).slice(0, 1024) },
      );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default settings;
