import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import type { BotClient } from "../index";

export default {
  data: new SlashCommandBuilder()
    .setName("setadminroles")
    .setDescription("Set which roles can use admin commands.")
    .addRoleOption(opt => opt.setName("role").setDescription("Select admin role").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const role = interaction.options.getRole("role");
    client.adminRoles = client.adminRoles || new Set();
    client.adminRoles.add(role!.id);
    await interaction.reply(`✅ Added ${role} as an admin role.`);
  },
};
