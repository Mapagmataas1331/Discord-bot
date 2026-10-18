import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { checkAssignableRole } from "../lib/roles.js";
import type { Command } from "../types.js";

const getrole: Command = {
  category: "admin",
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName("getrole")
    .setDescription("Post a message with a button that toggles a role (e.g. accept the rules).")
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("Role to give when the button is pressed").setRequired(true),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const role = interaction.options.getRole("role", true);

    const problem = checkAssignableRole(role);
    if (problem) {
      await interaction.reply({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
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

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

export default getrole;
