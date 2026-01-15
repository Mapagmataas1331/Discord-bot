import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import type { BotClient } from "../index";

export default {
  data: new SlashCommandBuilder()
    .setName("getrole")
    .setDescription("Create a message that gives a role when the button is pressed.")
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("Role to assign").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const role = interaction.options.getRole("role");
    if (!role) {
      await interaction.reply({
        content: "❌ Role not found.",
        flags: "Ephemeral",
      });

      return;
    }

    const button = new ButtonBuilder()
      .setCustomId(`getrole_${role.id}`)
      .setLabel("✅ I Agree / Согласен")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    const embed = new EmbedBuilder()
      .setTitle("🎉 Join the Community / Присоединяйтесь к сообществу!")
      .setDescription(
        "**English:**\nPressing this button means you agree with our rules and want to join our community!\n\n" +
        "**Русский:**\nНажимая эту кнопку, вы соглашаетесь с правилами и хотите присоединиться к нашему сообществу!"
      )
      .setColor(0x3ba55d)
      .setFooter({ text: `Role: ${role.name}` });

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  },
};
