import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { hasInnerRole } from "../lib/roleDedupe.js";
import { checkAssignableRole } from "../lib/roles.js";
import { getSettings } from "../lib/settings.js";

export const DEFAULT_WELCOME_MESSAGE = [
  "👋 **Welcome, {user}!** / **Привет, {user}!**",
  "🇬🇧 Glad you're here on **{server}**, you're member #{memberCount}. Read {rules}, then press **✅ I agree** in {gate} to unlock the server.",
  "🇷🇺 Рады видеть тебя на **{server}**, ты у нас {memberCount}-й. Прочитай {rules} и нажми **✅ Согласен** в {gate}, чтобы открыть сервер.",
].join("\n");

export function renderWelcome(template: string, member: GuildMember): string {
  const rulesId = member.guild.rulesChannelId;
  const gateId = getSettings(member.guild.id).gateChannelId;
  return template
    .replaceAll("{user}", `${member}`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{memberCount}", String(member.guild.memberCount))
    .replaceAll("{rules}", rulesId ? `<#${rulesId}>` : "the rules / правила")
    .replaceAll("{gate}", gateId ? `<#${gateId}>` : rulesId ? `<#${rulesId}>` : "the rules channel / канал с правилами");
}

/** Auto-role + welcome message. Requires the privileged GuildMembers intent. */
export async function handleMemberJoin(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  const settings = getSettings(member.guild.id);

  if (settings.autoRoleId && !hasInnerRole(member)) {
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
