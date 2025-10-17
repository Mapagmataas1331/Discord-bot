import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import type { BotClient } from "../index";

export default {
  data: new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Show the community rules."),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (client.cmdChannelId && interaction.channelId !== client.cmdChannelId) {
      return interaction.reply({
        content: "❌ Use this command in the command channel.",
        flags: "Ephemeral",
      });
    }

    const rulesEmbed = new EmbedBuilder()
      .setTitle("📜 Community Rules / Правила сообщества")
      .setDescription(
        [
          "**English:**",
          "1️⃣ Be kind and respectful.",
          "2️⃣ No hate speech or harassment.",
          "3️⃣ Keep channels clean and on-topic.",
          "4️⃣ No spam or self-promotion.",
          "5️⃣ Follow Discord ToS and community guidelines.",
          "",
          "**Русский:**",
          "1️⃣ Будьте вежливы и уважительны.",
          "2️⃣ Запрещены оскорбления и травля.",
          "3️⃣ Старайтесь писать по теме и поддерживать порядок в каналах.",
          "4️⃣ Без спама и саморекламы.",
          "5️⃣ Соблюдайте правила Discord и нашего сообщества.",
        ].join("\n")
      )
      .setColor(0x5865f2)
      .setFooter({ text: "We’re happy to have you here! / Мы рады видеть вас здесь! 💖" });

    await interaction.reply({ embeds: [rulesEmbed] });
  },
};
