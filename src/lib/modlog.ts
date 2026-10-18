import { EmbedBuilder, PermissionFlagsBits, type Guild, type User } from "discord.js";
import { getSettings } from "./settings.js";

export interface ModAction {
  action: string;
  moderator: User;
  target?: User | undefined;
  reason?: string | null | undefined;
  details?: string | undefined;
  color?: number | undefined;
}

/** Posts an embed to the configured mod log channel (silently skips if unset/unusable). */
export async function logModAction(guild: Guild, entry: ModAction): Promise<void> {
  const { modLogChannelId } = getSettings(guild.id);
  if (!modLogChannelId) return;

  try {
    const channel = guild.channels.cache.get(modLogChannelId);
    const me = guild.members.me;
    if (!channel || !me || !channel.isSendable()) return;
    if (!channel.permissionsFor(me).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ ${entry.action}`)
      .setColor(entry.color ?? 0xf0b232)
      .addFields({ name: "Moderator", value: `${entry.moderator} (${entry.moderator.id})`, inline: true })
      .setTimestamp();
    if (entry.target) {
      embed.addFields({ name: "Member", value: `${entry.target} (${entry.target.id})`, inline: true });
    }
    if (entry.details) embed.addFields({ name: "Details", value: entry.details.slice(0, 1024) });
    embed.addFields({ name: "Reason", value: (entry.reason || "No reason given").slice(0, 1024) });

    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.warn(`⚠️ Could not write to mod log in ${guild.name}:`, error);
  }
}
