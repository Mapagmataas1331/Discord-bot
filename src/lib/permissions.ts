import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { getSettings } from "./settings.js";

/** Manage Server / Administrator, or any role stored with /setadminroles. */
export function isBotAdmin(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const { adminRoleIds } = getSettings(member.guild.id);
  return adminRoleIds.some((id) => member.roles.cache.has(id));
}

/** Returns why `moderator` may not act on `target`, or null if allowed. */
export function checkModerationTarget(moderator: GuildMember, target: GuildMember): string | null {
  if (target.id === moderator.id) return "You can't use this on yourself.";
  if (target.id === target.client.user.id) return "I can't use this on myself.";
  if (target.id === target.guild.ownerId) return "The server owner can't be moderated.";
  if (
    moderator.id !== moderator.guild.ownerId &&
    target.roles.highest.comparePositionTo(moderator.roles.highest) >= 0
  ) {
    return "That member's highest role is equal to or above yours.";
  }
  return null;
}
