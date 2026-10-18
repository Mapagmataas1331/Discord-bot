import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { checkAssignableRole } from "../lib/roles.js";
import { getSettings } from "../lib/settings.js";

export const DEFAULT_WELCOME_MESSAGE = "👋 Welcome {user} to **{server}**! You are member #{memberCount}.";

export function renderWelcome(template: string, member: GuildMember): string {
  return template
    .replaceAll("{user}", `${member}`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{memberCount}", String(member.guild.memberCount));
}

/** Auto-role + welcome message. Requires the privileged GuildMembers intent. */
export async function handleMemberJoin(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  const settings = getSettings(member.guild.id);

  if (settings.autoRoleId) {
    const role = member.guild.roles.cache.get(settings.autoRoleId);
    const problem = role ? checkAssignableRole(role) : "role was deleted";
    if (role && !problem) {
      await member.roles.add(role, "Auto-role on join").catch((error: unknown) => {
        console.warn(`⚠️ Auto-role failed in ${member.guild.name}:`, error);
      });
    } else {
      console.warn(`⚠️ Skipping auto-role in ${member.guild.name}: ${problem}`);
    }
  }

  if (settings.welcomeChannelId) {
    const channel = member.guild.channels.cache.get(settings.welcomeChannelId);
    const me = member.guild.members.me;
    if (!channel || !me || !channel.isSendable()) return;
    if (!channel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) return;
    await channel
      .send({
        content: renderWelcome(settings.welcomeMessage ?? DEFAULT_WELCOME_MESSAGE, member),
        allowedMentions: { users: [member.id] },
      })
      .catch((error: unknown) => console.warn(`⚠️ Welcome message failed in ${member.guild.name}:`, error));
  }
}
