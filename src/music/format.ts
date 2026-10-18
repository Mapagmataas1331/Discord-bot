import { EmbedBuilder, type User } from "discord.js";
import type { Track, UnresolvedTrack } from "lavalink-client";

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** "1:23", "01:02:03", "83", "1m23s" -> ms */
export function parseTime(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (/^\d+(:\d{1,2}){0,2}$/.test(text)) {
    return text.split(":").reduce((acc, part) => acc * 60 + Number(part), 0) * 1000;
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (match && text.length > 0) {
    const [, h = "0", m = "0", s = "0"] = match;
    return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000;
  }
  return null;
}

export function trackDuration(track: Track | UnresolvedTrack): string {
  return track.info.isStream ? "🔴 LIVE" : formatTime(track.info.duration ?? 0);
}

export function trackLink(track: Track | UnresolvedTrack, max = 80): string {
  const title = (track.info.title || "Unknown title").replace(/[[\]]/g, "").slice(0, max);
  return track.info.uri ? `[${title}](${track.info.uri})` : title;
}

export function progressBar(position: number, duration: number, size = 18): string {
  if (!duration) return "▬".repeat(size);
  const ratio = Math.min(1, Math.max(0, position / duration));
  const index = Math.min(size - 1, Math.floor(ratio * size));
  return `${"▬".repeat(index)}🔘${"▬".repeat(size - index - 1)}`;
}

export function requesterOf(track: Track | UnresolvedTrack): string | null {
  const r = track.requester as { id?: string } | undefined;
  return r?.id ? `<@${r.id}>` : null;
}

export function trackEmbed(title: string, track: Track | UnresolvedTrack, color = 0x1db954): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: title })
    .setDescription(`**${trackLink(track, 200)}**`)
    .addFields(
      { name: "Duration", value: trackDuration(track), inline: true },
      { name: "Author", value: (track.info.author || "Unknown").slice(0, 100), inline: true },
    );
  const requester = requesterOf(track);
  if (requester) embed.addFields({ name: "Requested by", value: requester, inline: true });
  if (track.info.artworkUrl) embed.setThumbnail(track.info.artworkUrl);
  return embed;
}

export function toRequester(user: User): { id: string; username: string } {
  return { id: user.id, username: user.username };
}
