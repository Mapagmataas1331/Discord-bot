import { MessageFlags, type ButtonInteraction } from "discord.js";
import { checkAssignableRole, toggleRole } from "../lib/roles.js";

/** Handles self-assign role buttons. Re-validates the role on every click. */
export async function handleRoleButton(
  interaction: ButtonInteraction<"cached">,
  roleId: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const role =
    interaction.guild.roles.cache.get(roleId) ??
    (await interaction.guild.roles.fetch(roleId).catch(() => null));
  if (!role) {
    await interaction.editReply("❌ That role no longer exists. Ask a moderator to update this message.");
    return;
  }

  const problem = checkAssignableRole(role);
  if (problem) {
    await interaction.editReply(`❌ ${problem}`);
    return;
  }

  const result = await toggleRole(interaction.member, role);
  await interaction.editReply(
    result === "added"
      ? `✅ You now have the **${role.name}** role. Press the button again to remove it.`
      : `➖ Removed the **${role.name}** role. Press the button again to get it back.`,
  );
}
