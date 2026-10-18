import { ChannelType, Events, type Client, type Guild } from "discord.js";
import { LavalinkManager, type Player } from "lavalink-client";
import { config } from "../config.js";
import { trackEmbed } from "./format.js";

/** Leave after this long with nobody listening (alone in the channel, or the queue ran out). */
export const IDLE_LEAVE_MS = 3 * 60_000;

let manager: LavalinkManager | null = null;
const aloneTimers = new Map<string, NodeJS.Timeout>();

export function getLavalink(): LavalinkManager | null {
  return manager;
}

/** True when Lavalink is configured and at least one node is connected. */
export function musicAvailable(): boolean {
  return manager !== null && manager.useable;
}

async function announce(player: Player, payload: Parameters<typeof sendTo>[1]): Promise<void> {
  if (!player.textChannelId) return;
  await sendTo(player.textChannelId, payload);
}

let clientRef: Client | null = null;
async function sendTo(
  channelId: string,
  payload: string | { content?: string; embeds?: ReturnType<typeof trackEmbed>[] },
): Promise<void> {
  try {
    const channel = await clientRef?.channels.fetch(channelId);
    if (channel?.isSendable()) {
      await channel.send(typeof payload === "string" ? { content: payload, allowedMentions: { parse: [] } } : { ...payload, allowedMentions: { parse: [] } });
    }
  } catch {
    // channel gone or no permission; ignore
  }
}

function clearAloneTimer(guildId: string): void {
  const timer = aloneTimers.get(guildId);
  if (timer) clearTimeout(timer);
  aloneTimers.delete(guildId);
}

/** Starts/cancels the "alone in voice" leave timer for a guild. */
export function evaluateAlone(guild: Guild): void {
  const player = manager?.getPlayer(guild.id);
  if (!player?.voiceChannelId) {
    clearAloneTimer(guild.id);
    return;
  }
  const channel = guild.channels.cache.get(player.voiceChannelId);
  const listeners =
    channel && (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice)
      ? channel.members.filter((m) => !m.user.bot).size
      : 0;

  if (listeners > 0) {
    clearAloneTimer(guild.id);
    return;
  }
  if (aloneTimers.has(guild.id)) return;
  aloneTimers.set(
    guild.id,
    setTimeout(() => {
      aloneTimers.delete(guild.id);
      const current = manager?.getPlayer(guild.id);
      if (!current) return;
      void announce(current, "👋 Left the voice channel because nobody was listening.");
      void current.destroy("alone");
    }, IDLE_LEAVE_MS),
  );
}

/** Sets up the Lavalink client if LAVALINK_PASSWORD is configured. Safe to call once at startup. */
export function setupMusic(client: Client): void {
  const { host, port, password } = config.lavalink;
  if (!password) {
    console.log("🎵 Music disabled: LAVALINK_PASSWORD is not set.");
    return;
  }
  clientRef = client;

  manager = new LavalinkManager({
    nodes: [
      {
        id: "main",
        host,
        port,
        authorization: password,
        secure: false,
        retryAmount: 1_000_000, // effectively forever: reconnect whenever Lavalink comes back
        retryDelay: 10_000,
        heartBeatInterval: 30_000,
        enablePingOnStatsCheck: true,
      },
    ],
    sendToShard: (guildId, payload) => {
      client.guilds.cache.get(guildId)?.shard.send(payload);
    },
    autoSkip: true,
    emitNewSongsOnly: true,
    playerOptions: {
      defaultSearchPlatform: "ytsearch",
      volumeDecrementer: 1,
      clientBasedPositionUpdateInterval: 250,
      requesterTransformer: (requester) => {
        const r = requester as { id?: string; username?: string } | null;
        return r?.id ? { id: r.id, username: r.username ?? "" } : requester;
      },
      onDisconnect: { destroyPlayer: true },
      onEmptyQueue: { destroyAfterMs: IDLE_LEAVE_MS },
    },
    queueOptions: { maxPreviousTracks: 10 },
    advancedOptions: { debugOptions: { playerDestroy: { dontThrowError: true } } },
  });

  manager.nodeManager
    .on("connect", (node) => console.log(`🎵 Lavalink node "${node.id}" connected`))
    .on("reconnecting", (node) => console.warn(`🎵 Lavalink node "${node.id}" reconnecting...`))
    .on("disconnect", (node, reason) => {
      console.warn(`🎵 Lavalink node "${node.id}" disconnected: ${reason.reason ?? reason.code ?? "unknown"}`);
      // Players on a dead Lavalink session can't recover; clean them up so /play starts fresh after reconnect.
      for (const player of manager?.players.values() ?? []) {
        if (player.node.id !== node.id) continue;
        void announce(player, "⚠️ The audio server restarted, so playback stopped. Use /play to start again.");
        player.destroy("node-disconnect", true).catch(() => manager?.deletePlayer(player.guildId));
      }
    })
    .on("error", (node, error) => console.error(`🎵 Lavalink node "${node.id}" error: ${error.message}`));

  manager
    .on("trackStart", (player, track) => {
      if (track) void announce(player, { embeds: [trackEmbed("Now playing", track)] });
    })
    .on("trackError", (player, track, payload) => {
      const title = track?.info.title ?? "this track";
      console.warn(`🎵 Track error in ${player.guildId}: ${payload.exception?.message ?? "unknown"}`);
      void announce(player, `⚠️ Couldn't play **${title}**: ${payload.exception?.message ?? "unknown error"}. Skipping.`);
    })
    .on("trackStuck", (player, track) => {
      void announce(player, `⚠️ **${track?.info.title ?? "Track"}** got stuck. Skipping.`);
    })
    .on("queueEnd", (player) => {
      void announce(player, "✅ Queue finished. I'll leave in 3 minutes unless something else is queued.");
    })
    .on("playerDestroy", (player) => clearAloneTimer(player.guildId));

  // Lavalink needs Discord's raw voice state/server events.
  client.on(Events.Raw, (packet: { t?: string }) => {
    if (packet.t === "VOICE_STATE_UPDATE" || packet.t === "VOICE_SERVER_UPDATE" || packet.t === "CHANNEL_DELETE") {
      void manager?.sendRawData(packet as Parameters<LavalinkManager["sendRawData"]>[0]);
    }
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    evaluateAlone(newState.guild ?? oldState.guild);
  });

  client.once(Events.ClientReady, async (c) => {
    try {
      await manager?.init({ id: c.user.id, username: c.user.username });
      console.log(`🎵 Lavalink client initialised (node ${host}:${port})`);
    } catch (error) {
      console.error("🎵 Failed to initialise Lavalink client:", error);
    }
  });
}
