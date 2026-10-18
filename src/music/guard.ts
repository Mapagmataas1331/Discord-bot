import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
  type VoiceBasedChannel,
} from "discord.js";
import type { Player } from "lavalink-client";
import { getSettings } from "../lib/settings.js";
import { getLavalink, musicAvailable } from "./manager.js";

export const MUSIC_UNAVAILABLE = "🎵 Music is unavailable right now (the audio server isn't connected). Try again later.";

type Interaction = ChatInputCommandInteraction<"cached">;

async function fail(interaction: Interaction, content: string): Promise<null> {
  if (interaction.deferred || interaction.replied) await interaction.editReply({ content });
  else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  return null;
}

function humansIn(channel: VoiceBasedChannel): number {
  return channel.members.filter((m) => !m.user.bot).size;
}

/** DJ role (if configured), Manage Server, or being alone with the bot. */
export function isDj(member: GuildMember, channel: VoiceBasedChannel | null): boolean {
  const { djRoleId } = getSettings(member.guild.id);
  if (!djRoleId) return true;
  if (member.roles.cache.has(djRoleId)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return channel !== null && humansIn(channel) <= 1;
}

/**
 * Checks for controlling an existing player: music available, a player exists,
 * the member is in the bot's voice channel, and (optionally) DJ rights.
 */
export async function requirePlayer(
  interaction: Interaction,
  opts: { dj?: boolean; viewOnly?: boolean } = {},
): Promise<Player | null> {
  if (!musicAvailable()) return fail(interaction, MUSIC_UNAVAILABLE);
  const player = getLavalink()?.getPlayer(interaction.guildId);
  if (!player || !player.voiceChannelId) return fail(interaction, "ℹ️ Nothing is playing right now.");

  if (opts.viewOnly) return player;
  const memberChannel = interaction.member.voice.channel;
  if (memberChannel?.id !== player.voiceChannelId) {
    return fail(interaction, `🔊 Join <#${player.voiceChannelId}> to control the music.`);
  }
  if (opts.dj && !isDj(interaction.member, memberChannel)) {
    const { djRoleId } = getSettings(interaction.guildId);
    return fail(interaction, `🎧 Only members with the <@&${djRoleId}> role (or Manage Server) can do that, unless you're alone with me.`);
  }
  return player;
}

/** Checks for /play: music available, member in a joinable voice channel, not split from an active player. */
export async function requireVoiceForPlay(
  interaction: Interaction,
): Promise<{ channel: VoiceBasedChannel; player: Player | undefined } | null> {
  if (!musicAvailable()) return fail(interaction, MUSIC_UNAVAILABLE);
  const channel = interaction.member.voice.channel;
  if (!channel) return fail(interaction, "🔊 Join a voice channel first.");
  if (channel.type === ChannelType.GuildStageVoice) {
    return fail(interaction, "🎙️ Stage channels aren't supported yet; please use a regular voice channel.");
  }

  const me = interaction.guild.members.me;
  const perms = me ? channel.permissionsFor(me) : null;
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    return fail(interaction, `❌ I need **Connect** and **Speak** permissions in ${channel}.`);
  }
  if (channel.full && !channel.members.has(me?.id ?? "")) return fail(interaction, `❌ ${channel} is full.`);

  const player = getLavalink()?.getPlayer(interaction.guildId);
  if (player?.voiceChannelId && player.voiceChannelId !== channel.id && humansInPlayerChannel(interaction, player) > 0) {
    return fail(interaction, `🔊 I'm already playing in <#${player.voiceChannelId}>. Join that channel instead.`);
  }
  return { channel, player };
}

function humansInPlayerChannel(interaction: Interaction, player: Player): number {
  const channel = player.voiceChannelId ? interaction.guild.channels.cache.get(player.voiceChannelId) : undefined;
  return channel?.isVoiceBased() ? humansIn(channel) : 0;
}
