import { MessageFlags, type ButtonInteraction } from "discord.js";
import { hasInnerRole } from "../lib/roleDedupe.js";
import { checkAssignableRole, grantRole, toggleRole } from "../lib/roles.js";

/** Handles self-assign role buttons. Re-validates the role on every click. */
export async function handleRoleButton(
  interaction: ButtonInteraction<"cached">,
  roleId: string,
  mode: "toggle" | "grant" = "toggle",
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

  if (mode === "grant") {
    if (hasInnerRole(interaction.member)) {
      await interaction.editReply(
        "👌 You already have full access through your inner-circle role, nothing to unlock.\n👌 У тебя уже есть полный доступ через роль своих, открывать ничего не нужно.",
      );
      return;
    }
    const granted = await grantRole(interaction.member, role);
    await interaction.editReply(
      granted === "added"
        ? `✅ Welcome aboard! You now have **${role.name}** and can see the whole server.\n✅ Добро пожаловать! Теперь у тебя роль **${role.name}**, и весь сервер открыт.`
        : `👌 You already have **${role.name}**. / У тебя уже есть роль **${role.name}**.`,
    );
    return;
  }

  const result = await toggleRole(interaction.member, role);
  await interaction.editReply(
    result === "added"
      ? `✅ You now have the **${role.name}** role. Press the button again to remove it.`
      : `➖ Removed the **${role.name}** role. Press the button again to get it back.`,
  );
}
