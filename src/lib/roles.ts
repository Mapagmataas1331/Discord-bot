import { PermissionFlagsBits, type GuildMember, type Role } from "discord.js";

/** Permissions that must never be handed out through self-assign buttons/menus. */
export const DANGEROUS_PERMISSIONS: ReadonlyArray<readonly [bigint, string]> = [
  [PermissionFlagsBits.Administrator, "Administrator"],
  [PermissionFlagsBits.ManageGuild, "Manage Server"],
  [PermissionFlagsBits.ManageRoles, "Manage Roles"],
  [PermissionFlagsBits.ManageChannels, "Manage Channels"],
  [PermissionFlagsBits.ManageWebhooks, "Manage Webhooks"],
  [PermissionFlagsBits.ManageMessages, "Manage Messages"],
  [PermissionFlagsBits.ManageThreads, "Manage Threads"],
  [PermissionFlagsBits.ManageNicknames, "Manage Nicknames"],
  [PermissionFlagsBits.ManageGuildExpressions, "Manage Expressions"],
  [PermissionFlagsBits.ManageEvents, "Manage Events"],
  [PermissionFlagsBits.BanMembers, "Ban Members"],
  [PermissionFlagsBits.KickMembers, "Kick Members"],
  [PermissionFlagsBits.ModerateMembers, "Timeout Members"],
  [PermissionFlagsBits.MentionEveryone, "Mention Everyone"],
  [PermissionFlagsBits.ViewAuditLog, "View Audit Log"],
  [PermissionFlagsBits.MuteMembers, "Mute Members"],
  [PermissionFlagsBits.DeafenMembers, "Deafen Members"],
  [PermissionFlagsBits.MoveMembers, "Move Members"],
];

/**
 * Returns a human-readable reason why the bot must not hand out this role,
 * or null if it is safe to self-assign.
 */
export function checkAssignableRole(role: Role): string | null {
  const guild = role.guild;
  if (role.id === guild.id) return "@everyone can't be assigned.";
  if (role.managed) {
    return `**${role.name}** is managed by an integration or bot and can't be assigned manually.`;
  }

  const me = guild.members.me;
  if (!me) return "I couldn't check my own roles. Try again in a moment.";
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return "I need the **Manage Roles** permission to do that.";
  }
  if (role.comparePositionTo(me.roles.highest) >= 0) {
    return `**${role.name}** is at or above my highest role. Move my role above it in Server Settings → Roles.`;
  }

  const elevated = DANGEROUS_PERMISSIONS.filter(([bit]) => role.permissions.has(bit, false)).map(
    ([, name]) => name,
  );
  if (elevated.length > 0) {
    return `**${role.name}** has elevated permissions (${elevated.join(", ")}) and can't be self-assigned.`;
  }
  return null;
}

/** Adds the role if the member lacks it, removes it otherwise. */
export async function toggleRole(member: GuildMember, role: Role): Promise<"added" | "removed"> {
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role, "Self-assign toggle");
    return "removed";
  }
  await member.roles.add(role, "Self-assign toggle");
  return "added";
}

/** Adds the role if the member lacks it; never removes it (rules gate). */
export async function grantRole(member: GuildMember, role: Role): Promise<"added" | "already"> {
  if (member.roles.cache.has(role.id)) return "already";
  await member.roles.add(role, "Accepted the rules");
  return "added";
}
