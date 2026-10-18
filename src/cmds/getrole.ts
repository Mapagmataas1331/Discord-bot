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
import { setSetting } from "../lib/settings.js";
import type { Command } from "../types.js";

const getrole: Command = {
  category: "admin",
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName("getrole")
    .setDescription("Post a button that gives a role (toggle, or a grant-only rules gate).")
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("Role to give when the button is pressed").setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("toggle: press again to remove (default). agree: rules gate, only ever grants the role")
        .addChoices({ name: "toggle", value: "toggle" }, { name: "agree (rules gate)", value: "agree" }),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const role = interaction.options.getRole("role", true);

    const problem = checkAssignableRole(role);
    if (problem) {
      await interaction.reply({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
      return;
    }

    const agree = interaction.options.getString("mode") === "agree";

    if (agree) {
      const rules = interaction.guild.rulesChannelId ? `<#${interaction.guild.rulesChannelId}>` : "the rules / правила";
      const button = new ButtonBuilder()
        .setCustomId(`agree_${role.id}`)
        .setLabel("I agree / Согласен")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);
      const embed = rulesGateEmbed(rules).setFooter({ text: `Role: ${role.name}` });
      // The welcome message links here ({gate}).
      setSetting(interaction.guildId, "gateChannelId", interaction.channelId);
      await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)] });
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

/** Bilingual "read the rules, then press the button" embed used by the rules gate. */
export function rulesGateEmbed(rulesMention: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("✅ Unlock the server / Открыть сервер")
    .setColor(0x3ba55d)
    .setDescription(
      [
        "🇬🇧 **Welcome!** Please read " + rulesMention + " first.",
        "When you're ready, press **✅ I agree** below to get access to all channels.",
        "",
        "🇷🇺 **Добро пожаловать!** Сначала прочитай " + rulesMention + ".",
        "Когда будешь готов, нажми **✅ Согласен** ниже, чтобы открыть все каналы.",
      ].join("\n"),
    );
}

export default getrole;
