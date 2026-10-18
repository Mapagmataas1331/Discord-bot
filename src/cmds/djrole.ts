import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { setSetting } from "../lib/settings.js";
import type { Command } from "../types.js";

const djrole: Command = {
  category: "admin",
  adminOnly: true,
  anyChannel: true,
  data: new SlashCommandBuilder()
    .setName("djrole")
    .setDescription("Require a DJ role for music controls (skip, stop, volume, ...).")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the DJ role.")
        .addRoleOption((opt) => opt.setName("role").setDescription("DJ role").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("clear").setDescription("Let everyone in the voice channel control the music."))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (interaction.options.getSubcommand(true) === "clear") {
      setSetting(interaction.guildId, "djRoleId", null);
      await interaction.reply({ content: "✅ DJ role cleared: anyone listening can control the music.", flags: MessageFlags.Ephemeral });
      return;
    }
    const role = interaction.options.getRole("role", true);
    if (role.id === interaction.guildId) {
      await interaction.reply({ content: "❌ Use `/djrole clear` instead of @everyone.", flags: MessageFlags.Ephemeral });
      return;
    }
    setSetting(interaction.guildId, "djRoleId", role.id);
    await interaction.reply({
      content: `✅ Music controls now need ${role} (or Manage Server). Anyone alone with the bot can still control it.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};

export default djrole;
