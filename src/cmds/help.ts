import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type APIApplicationCommandOption,
} from "discord.js";
import { isBotAdmin } from "../lib/permissions.js";
import type { Command, CommandCategory } from "../types.js";

const CATEGORY_TITLES: Record<CommandCategory, string> = {
  general: "📌 General",
  music: "🎵 Music",
  utility: "🧰 Utility",
  moderation: "🛡️ Moderation",
  admin: "⚙️ Admin",
};

function describeOptions(options: readonly APIApplicationCommandOption[] | undefined): string[] {
  if (!options) return [];
  return options.map((opt) => {
    if (opt.type === ApplicationCommandOptionType.Subcommand) {
      const args = (opt.options ?? []).map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(" ");
      return `\`${opt.name}${args ? ` ${args}` : ""}\` · ${opt.description}`;
    }
    return `\`${"required" in opt && opt.required ? `<${opt.name}>` : `[${opt.name}]`}\` · ${opt.description}`;
  });
}

const help: Command = {
  category: "general",
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List the commands you can use.")
    .addStringOption((opt) => opt.setName("command").setDescription("Show details for one command"))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    // Lazy import avoids a circular import with the registry.
    const { commands } = await import("./index.js");
    const admin = isBotAdmin(interaction.member);
    const canUse = (c: Command) =>
      (!c.adminOnly || admin) &&
      (c.requiredPermissions === undefined || interaction.memberPermissions.has(c.requiredPermissions));
    const visible = commands.filter(canUse);

    const name = interaction.options.getString("command")?.replace(/^\//, "").toLowerCase();
    if (name) {
      const command = visible.find((c) => c.data.name === name);
      if (!command) {
        await interaction.reply({ content: `❌ No command \`/${name}\` that you can use.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const json = command.data.toJSON();
      const lines = describeOptions(json.options);
      const embed = new EmbedBuilder()
        .setTitle(`/${json.name}`)
        .setDescription(`${json.description}${lines.length > 0 ? `\n\n${lines.join("\n")}` : ""}`)
        .setColor(0x5865f2);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📖 Commands")
      .setColor(0x5865f2)
      .setFooter({ text: "Use /help command:<name> for details." });
    for (const category of Object.keys(CATEGORY_TITLES) as CommandCategory[]) {
      const inCategory = visible.filter((c) => c.category === category);
      if (inCategory.length === 0) continue;
      embed.addFields({
        name: CATEGORY_TITLES[category],
        value: inCategory.map((c) => `\`/${c.data.name}\` · ${c.data.description}`).join("\n").slice(0, 1024),
      });
    }
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default help;
