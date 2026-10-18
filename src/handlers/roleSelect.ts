import { MessageFlags, type StringSelectMenuInteraction } from "discord.js";
import { checkAssignableRole, toggleRole } from "../lib/roles.js";

export const ROLE_MENU_SELECT_ID = "rolemenu-select";

/** Toggles every role picked in a /rolemenu select menu. */
export async function handleRoleSelect(interaction: StringSelectMenuInteraction<"cached">): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const lines: string[] = [];
  for (const roleId of interaction.values) {
    const role =
      interaction.guild.roles.cache.get(roleId) ??
      (await interaction.guild.roles.fetch(roleId).catch(() => null));
    if (!role) {
      lines.push("❌ A role in this menu no longer exists.");
      continue;
    }
    const problem = checkAssignableRole(role);
    if (problem) {
      lines.push(`❌ ${problem}`);
      continue;
    }
    const result = await toggleRole(interaction.member, role);
    lines.push(result === "added" ? `✅ Added **${role.name}**` : `➖ Removed **${role.name}**`);
  }

  await interaction.editReply(lines.join("\n") || "Nothing changed.");
}
