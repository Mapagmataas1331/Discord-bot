import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { getSettings } from "./settings.js";

/** Manage Server / Administrator, or any role stored with /setadminroles. */
export function isBotAdmin(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const { adminRoleIds } = getSettings(member.guild.id);
  return adminRoleIds.some((id) => member.roles.cache.has(id));
}
