/**
 * Role dedupe: a member who has the inner role (e.g. "⭐ Свои / Inner circle") doesn't also need the
 * base member role, so the bot removes the member role. Runs on startup, whenever a member's roles
 * change, and on a timer. Configured per guild with /innerrole (member_role_id + inner_role_id).
 */
import { PermissionFlagsBits, type Client, type Guild, type GuildMember } from "discord.js";
import { getSettings } from "./settings.js";

const REASON = "Has the inner role; the member role is redundant";

/** True if the member counts as verified: has the member role or the inner role. */
export function isVerified(member: GuildMember): boolean {
  const { memberRoleId, innerRoleId } = getSettings(member.guild.id);
  return Boolean(
    (memberRoleId && member.roles.cache.has(memberRoleId)) || (innerRoleId && member.roles.cache.has(innerRoleId)),
  );
}

/** True if the member already has the configured inner role. */
export function hasInnerRole(member: GuildMember): boolean {
  const { innerRoleId } = getSettings(member.guild.id);
  return Boolean(innerRoleId && member.roles.cache.has(innerRoleId));
}

/** Why the bot can't dedupe in this guild, or null if it can. */
function dedupeProblem(guild: Guild, memberRoleId: string): string | null {
  const me = guild.members.me;
  const role = guild.roles.cache.get(memberRoleId);
  if (!me || !role) return "member role not found";
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return "missing Manage Roles";
  if (role.comparePositionTo(me.roles.highest) >= 0) return "member role is at or above the bot's highest role";
  return null;
}

/** Removes the member role if the member also has the inner role. Returns true if it changed something. */
export async function dedupeMember(member: GuildMember): Promise<boolean> {
  if (member.user.bot) return false;
  const { memberRoleId, innerRoleId } = getSettings(member.guild.id);
  if (!memberRoleId || !innerRoleId || memberRoleId === innerRoleId) return false;
  if (!member.roles.cache.has(memberRoleId) || !member.roles.cache.has(innerRoleId)) return false;
  const problem = dedupeProblem(member.guild, memberRoleId);
  if (problem) {
    console.warn(`⚠️ Role dedupe skipped in ${member.guild.name}: ${problem}`);
    return false;
  }
  await member.roles.remove(memberRoleId, REASON);
  console.log(`🧹 Role dedupe: removed the member role from ${member.user.tag} in ${member.guild.name}`);
  return true;
}

/** Checks every member of the guild. Returns how many members were changed. */
export async function dedupeGuild(guild: Guild): Promise<number> {
  const { memberRoleId, innerRoleId } = getSettings(guild.id);
  if (!memberRoleId || !innerRoleId) return 0;
  const members = await guild.members.fetch();
  let changed = 0;
  for (const member of members.values()) {
    try {
      if (await dedupeMember(member)) changed++;
    } catch (error) {
      console.warn(`⚠️ Role dedupe failed for ${member.user.tag}:`, error);
    }
  }
  return changed;
}

/** Runs the dedupe for every guild now and then every `intervalMs` (default 45 minutes). */
export function startRoleDedupeScheduler(client: Client, intervalMs = 45 * 60_000): NodeJS.Timeout {
  const run = async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const changed = await dedupeGuild(guild);
        if (changed > 0) console.log(`🧹 Role dedupe in ${guild.name}: ${changed} member(s) updated`);
      } catch (error) {
        console.warn(`⚠️ Role dedupe pass failed in ${guild.name}:`, error);
      }
    }
  };
  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return timer;
}
