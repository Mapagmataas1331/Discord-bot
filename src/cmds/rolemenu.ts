import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type Role,
} from "discord.js";
import { ROLE_MENU_SELECT_ID } from "../handlers/roleSelect.js";
import { checkAssignableRole } from "../lib/roles.js";
import type { Command } from "../types.js";

const MAX_ROLES = 10;

const builder = new SlashCommandBuilder()
  .setName("rolemenu")
  .setDescription("Post a self-assign role menu (members toggle roles on/off).")
  .setContexts(InteractionContextType.Guild)
  .addStringOption((opt) =>
    opt.setName("title").setDescription("Menu title").setRequired(true).setMaxLength(200),
  )
  .addRoleOption((opt) => opt.setName("role1").setDescription("Role 1").setRequired(true))
  .addStringOption((opt) =>
    opt
      .setName("style")
      .setDescription("Buttons (default) or a dropdown")
      .addChoices({ name: "Buttons", value: "buttons" }, { name: "Dropdown", value: "select" }),
  )
  .addStringOption((opt) =>
    opt.setName("description").setDescription("Text shown above the roles").setMaxLength(1000),
  );
for (let i = 2; i <= MAX_ROLES; i++) {
  builder.addRoleOption((opt) => opt.setName(`role${i}`).setDescription(`Role ${i}`));
}

const rolemenu: Command = {
  category: "admin",
  adminOnly: true,
  anyChannel: true,
  data: builder,

  async execute(interaction) {
    const roles: Role[] = [];
    for (let i = 1; i <= MAX_ROLES; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role && !roles.some((r) => r.id === role.id)) roles.push(role);
    }

    const problems = roles.map(checkAssignableRole).filter((p): p is string => p !== null);
    if (problems.length > 0) {
      await interaction.reply({
        content: `❌ Can't create the menu:\n${problems.map((p) => `• ${p}`).join("\n")}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const title = interaction.options.getString("title", true);
    const description = interaction.options.getString("description");
    const style = interaction.options.getString("style") ?? "buttons";

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(
        `${description ? `${description}\n\n` : ""}${roles.map((r) => `• ${r}`).join("\n")}\n\n` +
          (style === "select"
            ? "_Pick roles from the menu to toggle them on or off._"
            : "_Press a button to toggle that role on or off._"),
      )
      .setColor(0x5865f2);

    const rows =
      style === "select"
        ? [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(ROLE_MENU_SELECT_ID)
                .setPlaceholder("Choose roles to toggle")
                .setMinValues(1)
                .setMaxValues(roles.length)
                .addOptions(roles.map((r) => ({ label: r.name.slice(0, 100), value: r.id }))),
            ),
          ]
        : chunk(roles, 5).map((group) =>
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              group.map((r) =>
                new ButtonBuilder()
                  .setCustomId(`rolemenu_${r.id}`)
                  .setLabel(r.name.slice(0, 80))
                  .setStyle(ButtonStyle.Secondary),
              ),
            ),
          );

    await interaction.reply({ embeds: [embed], components: rows, allowedMentions: { parse: [] } });
  },
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default rolemenu;
