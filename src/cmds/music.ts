import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { RepeatMode, Track, UnresolvedTrack } from "lavalink-client";
import { checkPublicUrl, looksLikeUrl } from "../lib/url.js";
import { requirePlayer, requireVoiceForPlay } from "../music/guard.js";
import { describeTrackError, getLavalink, markAnnouncedByReply, musicAvailable } from "../music/manager.js";
import {
  formatTime,
  parseTime,
  progressBar,
  requesterOf,
  toRequester,
  trackDuration,
  trackEmbed,
  trackLink,
} from "../music/format.js";
import type { Command } from "../types.js";

const MAX_QUEUE = 500;
const PAGE_SIZE = 10;

type Interaction = ChatInputCommandInteraction<"cached">;

/** Marks a command builder as guild-only (setContexts mutates the builder). */
const guild = <T extends { setContexts(...contexts: InteractionContextType[]): unknown }>(builder: T): T => {
  builder.setContexts(InteractionContextType.Guild);
  return builder;
};

async function done(interaction: Interaction, content: string, ephemeral = false): Promise<void> {
  await interaction.reply({ content, allowedMentions: { parse: [] }, ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}) });
}

// ---------------------------------------------------------------- /play
const play: Command = {
  category: "music",
  data: guild(
    new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play a song or playlist from YouTube, Apple Music, Vimeo, Twitch, Bandcamp or a direct link.")
      .addStringOption((opt) =>
        opt.setName("query").setDescription("Search terms or a URL").setRequired(true).setMaxLength(500).setAutocomplete(true),
      )
      .addBooleanOption((opt) => opt.setName("next").setDescription("Put it at the front of the queue")),
  ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().trim();
    if (focused.length < 2 || looksLikeUrl(focused) || !musicAvailable()) {
      await interaction.respond([]);
      return;
    }
    try {
      const node = getLavalink()?.nodeManager.leastUsedNodes()[0];
      if (!node) {
        await interaction.respond([]);
        return;
      }
      const result = await Promise.race([
        node.search({ query: focused, source: "ytsearch" }, interaction.user),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
      ]);
      const choices = (result?.tracks ?? [])
        .filter((t) => t.info.uri && t.info.uri.length <= 100)
        .slice(0, 10)
        .map((t) => ({
          name: `${t.info.title} — ${t.info.author} (${trackDuration(t)})`.slice(0, 100),
          value: t.info.uri,
        }));
      await interaction.respond(choices);
    } catch {
      await interaction.respond([]).catch(() => undefined);
    }
  },

  async execute(interaction) {
    const query = interaction.options.getString("query", true).trim();
    const playNext = interaction.options.getBoolean("next") ?? false;

    const voice = await requireVoiceForPlay(interaction);
    if (!voice) return;

    if (looksLikeUrl(query)) {
      const checked = await checkPublicUrl(query);
      if (typeof checked === "string") {
        await done(interaction, `❌ ${checked}`, true);
        return;
      }
    }

    await interaction.deferReply();
    const lavalink = getLavalink();
    if (!lavalink) return;

    let player = voice.player;
    if (player && player.voiceChannelId !== voice.channel.id) {
      await player.destroy("moved");
      player = undefined;
    }
    if (!player) {
      player = lavalink.createPlayer({
        guildId: interaction.guildId,
        voiceChannelId: voice.channel.id,
        textChannelId: interaction.channelId,
        selfDeaf: true,
        volume: 80,
      });
    }
    if (!player.connected) await player.connect();

    const result = await player.search(
      looksLikeUrl(query) ? { query } : { query, source: "ytsearch" },
      toRequester(interaction.user),
    );

    if (result.loadType === "error" || result.loadType === "empty" || result.tracks.length === 0) {
      const reason = result.loadType === "error" ? `: ${describeTrackError(result.exception?.message)}` : "";
      await interaction.editReply(`❌ Nothing found for \`${query.slice(0, 100)}\`${reason}.`);
      if (!player.queue.current && player.queue.tracks.length === 0) await player.destroy("nothing-found");
      return;
    }

    const room = MAX_QUEUE - player.queue.tracks.length;
    if (room <= 0) {
      await interaction.editReply(`❌ The queue is full (${MAX_QUEUE} tracks).`);
      return;
    }

    // Starting from silence: the reply itself is the "Now playing" message, so trackStart doesn't post a second one.
    const startsNow = !player.playing && !player.paused;
    let embed: EmbedBuilder;
    if (result.loadType === "playlist") {
      const tracks = result.tracks.slice(0, room) as (Track | UnresolvedTrack)[];
      await player.queue.add(tracks, playNext ? 0 : undefined);
      const first = player.queue.tracks[0];
      embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setAuthor({ name: "Playlist queued" })
        .setDescription(
          `**${result.playlist?.name ?? "Playlist"}**: ${tracks.length} track(s)` +
            (tracks.length < result.tracks.length ? ` (queue limit reached, ${result.tracks.length - tracks.length} skipped)` : "") +
            (startsNow && first ? `\n\n▶️ **Now playing:** ${trackLink(first)} · ${trackDuration(first)}` : ""),
        );
      if (result.playlist?.thumbnail) embed.setThumbnail(result.playlist.thumbnail);
      if (startsNow && first) markAnnouncedByReply(interaction.guildId, first);
    } else {
      const track = result.tracks[0] as Track;
      await player.queue.add(track, playNext ? 0 : undefined);
      if (startsNow) {
        embed = trackEmbed("Now playing", track);
        markAnnouncedByReply(interaction.guildId, track);
      } else {
        const position = playNext ? 1 : player.queue.tracks.length;
        embed = trackEmbed(`Queued at position ${position}`, track);
      }
    }

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    if (startsNow) await player.play();
  },
};

// ---------------------------------------------------------------- simple controls
const pause: Command = {
  category: "music",
  data: guild(new SlashCommandBuilder().setName("pause").setDescription("Pause the music.")),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { dj: true });
    if (!player) return;
    if (player.paused) return done(interaction, "⏸️ Already paused.", true);
    await player.pause();
    await done(interaction, "⏸️ Paused.");
  },
};

const resume: Command = {
  category: "music",
  data: guild(new SlashCommandBuilder().setName("resume").setDescription("Resume the music.")),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { dj: true });
    if (!player) return;
    if (!player.paused) return done(interaction, "▶️ Not paused.", true);
    await player.resume();
    await done(interaction, "▶️ Resumed.");
  },
};

const skip: Command = {
  category: "music",
  data: guild(
    new SlashCommandBuilder()
      .setName("skip")
      .setDescription("Skip the current track.")
      .addIntegerOption((opt) => opt.setName("to").setDescription("Skip to this queue position").setMinValue(1)),
  ),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { dj: true });
    if (!player) return;
    const current = player.queue.current;
    const to = interaction.options.getInteger("to");
    if (player.queue.tracks.length === 0) {
      await player.stopPlaying(false, false);
      return done(interaction, `⏭️ Skipped **${current?.info.title ?? "track"}**. The queue is now empty.`);
    }
    if (to !== null && to > player.queue.tracks.length) {
      return done(interaction, `❌ The queue only has ${player.queue.tracks.length} track(s).`, true);
    }
    await player.skip(to ?? 0);
    await done(interaction, `⏭️ Skipped **${current?.info.title ?? "track"}**.`);
  },
};

function stopCommand(name: "stop" | "leave", description: string): Command {
  return {
    category: "music",
    data: guild(new SlashCommandBuilder().setName(name).setDescription(description)),
    async execute(interaction) {
      const player = await requirePlayer(interaction, { dj: true });
      if (!player) return;
      await player.destroy(name);
      await done(interaction, name === "stop" ? "⏹️ Stopped, cleared the queue and left." : "👋 Left the voice channel.");
    },
  };
}

// ---------------------------------------------------------------- info
const queue: Command = {
  category: "music",
  data: guild(
    new SlashCommandBuilder()
      .setName("queue")
      .setDescription("Show the queue.")
      .addIntegerOption((opt) => opt.setName("page").setDescription("Page number").setMinValue(1)),
  ),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { viewOnly: true });
    if (!player) return;
    const tracks = player.queue.tracks;
    const pages = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));
    const page = Math.min(interaction.options.getInteger("page") ?? 1, pages);
    const start = (page - 1) * PAGE_SIZE;
    const current = player.queue.current;
    const total = tracks.reduce((sum, t) => sum + (t.info.isStream ? 0 : t.info.duration ?? 0), 0);

    const lines = tracks
      .slice(start, start + PAGE_SIZE)
      .map((t, i) => `\`${start + i + 1}.\` ${trackLink(t, 60)} · ${trackDuration(t)}${requesterOf(t) ? ` · ${requesterOf(t)}` : ""}`);
    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle("🎶 Queue")
      .setDescription(
        `${current ? `**Now:** ${trackLink(current)} · ${trackDuration(current)}\n\n` : ""}` +
          (lines.length > 0 ? lines.join("\n") : "_Nothing queued._"),
      )
      .setFooter({
        text: `Page ${page}/${pages} · ${tracks.length} track(s) · ${formatTime(total)} · loop: ${player.repeatMode} · volume: ${player.volume}%`,
      });
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

const nowplaying: Command = {
  category: "music",
  data: guild(new SlashCommandBuilder().setName("nowplaying").setDescription("Show the current track and progress.")),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { viewOnly: true });
    if (!player) return;
    const current = player.queue.current;
    if (!current) return done(interaction, "ℹ️ Nothing is playing right now.", true);
    const embed = trackEmbed(player.paused ? "Paused" : "Now playing", current);
    embed.addFields({
      name: "Progress",
      value: current.info.isStream
        ? "🔴 LIVE"
        : `${progressBar(player.position, current.info.duration)}\n\`${formatTime(player.position)} / ${formatTime(current.info.duration)}\``,
    });
    embed.setFooter({ text: `Loop: ${player.repeatMode} · Volume: ${player.volume}% · ${player.queue.tracks.length} in queue` });
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

// ---------------------------------------------------------------- settings-ish
const volume: Command = {
  category: "music",
  data: guild(
    new SlashCommandBuilder()
      .setName("volume")
      .setDescription("Set the volume (0-150).")
      .addIntegerOption((opt) => opt.setName("percent").setDescription("0-150").setMinValue(0).setMaxValue(150).setRequired(true)),
  ),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { dj: true });
    if (!player) return;
    const value = interaction.options.getInteger("percent", true);
    await player.setVolume(value);
    await done(interaction, `🔊 Volume set to **${value}%**.`);
  },
};

const loop: Command = {
  category: "music",
  data: guild(
    new SlashCommandBuilder()
      .setName("loop")
      .setDescription("Loop the current track or the whole queue.")
      .addStringOption((opt) =>
        opt
          .setName("mode")
          .setDescription("Loop mode")
          .setRequired(true)
          .addChoices({ name: "Off", value: "off" }, { name: "Track", value: "track" }, { name: "Queue", value: "queue" }),
      ),
  ),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { dj: true });
    if (!player) return;
    const mode = interaction.options.getString("mode", true) as RepeatMode;
    await player.setRepeatMode(mode);
    await done(interaction, { off: "➡️ Loop off.", track: "🔂 Looping the current track.", queue: "🔁 Looping the queue." }[mode]);
  },
};

const shuffle: Command = {
  category: "music",
  data: guild(new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue.")),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { dj: true });
    if (!player) return;
    if (player.queue.tracks.length < 2) return done(interaction, "ℹ️ Not enough tracks to shuffle.", true);
    await player.queue.shuffle();
    await done(interaction, `🔀 Shuffled ${player.queue.tracks.length} tracks.`);
  },
};

const remove: Command = {
  category: "music",
  data: guild(
    new SlashCommandBuilder()
      .setName("remove")
      .setDescription("Remove a track from the queue.")
      .addIntegerOption((opt) => opt.setName("position").setDescription("Queue position (see /queue)").setMinValue(1).setRequired(true)),
  ),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { dj: true });
    if (!player) return;
    const position = interaction.options.getInteger("position", true);
    if (position > player.queue.tracks.length) {
      return done(interaction, `❌ The queue only has ${player.queue.tracks.length} track(s).`, true);
    }
    const result = await player.queue.remove(position - 1);
    const removed = result?.removed[0];
    await done(interaction, removed ? `🗑️ Removed **${removed.info.title}**.` : "❌ Couldn't remove that track.");
  },
};

const seek: Command = {
  category: "music",
  data: guild(
    new SlashCommandBuilder()
      .setName("seek")
      .setDescription("Jump to a time in the current track.")
      .addStringOption((opt) => opt.setName("time").setDescription("e.g. 1:23, 83, 1m23s").setRequired(true)),
  ),
  async execute(interaction) {
    const player = await requirePlayer(interaction, { dj: true });
    if (!player) return;
    const current = player.queue.current;
    if (!current) return done(interaction, "ℹ️ Nothing is playing right now.", true);
    if (!current.info.isSeekable || current.info.isStream) return done(interaction, "❌ This track can't be seeked.", true);
    const ms = parseTime(interaction.options.getString("time", true));
    if (ms === null || ms > current.info.duration) {
      return done(interaction, `❌ Give a time between 0:00 and ${formatTime(current.info.duration)}.`, true);
    }
    await player.seek(ms);
    await done(interaction, `⏩ Jumped to **${formatTime(ms)}**.`);
  },
};

export const musicCommands: readonly Command[] = [
  play,
  pause,
  resume,
  skip,
  stopCommand("stop", "Stop the music, clear the queue and leave."),
  queue,
  nowplaying,
  volume,
  loop,
  shuffle,
  remove,
  seek,
  stopCommand("leave", "Leave the voice channel."),
];
