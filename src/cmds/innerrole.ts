import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { dedupeGuild } from "../lib/roleDedupe.js";
import { getSettings, setSetting } from "../lib/settings.js";
import type { Command } from "../types.js";

const innerrole: Command = {
  category: "admin",
  adminOnly: true,
  anyChannel: true,
  data: new SlashCommandBuilder()
    .setName("innerrole")
    .setDescription("Members with the inner role lose the (redundant) member role automatically.")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the member role and the inner role that replaces it.")
        .addRoleOption((opt) => opt.setName("member").setDescription("Base member role (from the rules gate)").setRequired(true))
        .addRoleOption((opt) => opt.setName("inner").setDescription("Inner-circle role that replaces it").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("clear").setDescription("Turn the role dedupe off."))
    .addSubcommand((sub) => sub.setName("run").setDescription("Check every member now."))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);
    if (sub === "clear") {
      setSetting(interaction.guildId, "memberRoleId", null);
      setSetting(interaction.guildId, "innerRoleId", null);
      await interaction.reply({ content: "✅ Role dedupe turned off.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === "set") {
      const member = interaction.options.getRole("member", true);
      const inner = interaction.options.getRole("inner", true);
      if (member.id === inner.id || member.id === interaction.guildId || inner.id === interaction.guildId) {
        await interaction.reply({ content: "❌ Pick two different roles (not @everyone).", flags: MessageFlags.Ephemeral });
        return;
      }
      setSetting(interaction.guildId, "memberRoleId", member.id);
      setSetting(interaction.guildId, "innerRoleId", inner.id);
    }
    const { memberRoleId, innerRoleId } = getSettings(interaction.guildId);
    if (!memberRoleId || !innerRoleId) {
      await interaction.reply({ content: "❌ Not configured. Use `/innerrole set` first.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const changed = await dedupeGuild(interaction.guild);
    await interaction.editReply({
      content: `✅ Members with <@&${innerRoleId}> don't keep <@&${memberRoleId}>. Checked everyone now: ${changed} member(s) updated. The bot also checks on every role change and every 45 minutes.`,
      allowedMentions: { parse: [] },
    });
  },
};

export default innerrole;
