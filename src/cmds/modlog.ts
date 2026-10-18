import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { setSetting } from "../lib/settings.js";
import type { Command } from "../types.js";

const modlog: Command = {
  category: "admin",
  adminOnly: true,
  anyChannel: true,
  data: new SlashCommandBuilder()
    .setName("modlog")
    .setDescription("Configure the channel where moderation actions are logged.")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the mod log channel.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Text channel")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName("clear").setDescription("Stop logging moderation actions."))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (interaction.options.getSubcommand(true) === "clear") {
      setSetting(interaction.guildId, "modLogChannelId", null);
      await interaction.reply({ content: "✅ Mod log disabled.", flags: MessageFlags.Ephemeral });
      return;
    }

    const channel = interaction.options.getChannel("channel", true, [ChannelType.GuildText]);
    const me = interaction.guild.members.me;
    if (me && !channel.permissionsFor(me).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      await interaction.reply({
        content: `❌ I need **Send Messages** and **Embed Links** in ${channel}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    setSetting(interaction.guildId, "modLogChannelId", channel.id);
    await interaction.reply({ content: `✅ Moderation actions will be logged in ${channel}.`, flags: MessageFlags.Ephemeral });
  },
};

export default modlog;
