import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { checkPublicUrl } from "../lib/url.js";
import type { Command } from "../types.js";

interface OEmbed {
  title?: string;
  author_name?: string;
  provider_name?: string;
  thumbnail_url?: string;
}

const OEMBED_ENDPOINTS: Array<[RegExp, string]> = [
  [/(^|\.)(youtube\.com|youtu\.be)$/i, "https://www.youtube.com/oembed?format=json&url="],
  [/(^|\.)vimeo\.com$/i, "https://vimeo.com/api/oembed.json?url="],
  [/(^|\.)twitch\.tv$/i, ""],
];

async function fetchOEmbed(url: URL): Promise<OEmbed | null> {
  const endpoint = OEMBED_ENDPOINTS.find(([re]) => re.test(url.hostname))?.[1];
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint + encodeURIComponent(url.toString()), { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    return (await res.json()) as OEmbed;
  } catch {
    return null;
  }
}

const watch: Command = {
  category: "utility",
  data: new SlashCommandBuilder()
    .setName("watch")
    .setDescription("Share a video link with a preview (bots can't stream video in voice).")
    .addStringOption((opt) => opt.setName("url").setDescription("Video URL (YouTube, Vimeo, ...)").setRequired(true).setMaxLength(500))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const checked = await checkPublicUrl(interaction.options.getString("url", true));
    if (typeof checked === "string") {
      await interaction.reply({ content: `❌ ${checked}`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply();
    const meta = await fetchOEmbed(checked);

    const embed = new EmbedBuilder()
      .setColor(0xff0033)
      .setTitle((meta?.title ?? checked.hostname).slice(0, 256))
      .setURL(checked.toString())
      .setDescription(
        `🎬 Shared by ${interaction.user}\n\n` +
          "_Discord doesn't let bots stream video into voice channels. Open the link to watch, " +
          "or start **Watch Together** from the voice channel's Activities menu to watch as a group._",
      );
    if (meta?.author_name) embed.setAuthor({ name: meta.author_name.slice(0, 256) });
    if (meta?.thumbnail_url) embed.setImage(meta.thumbnail_url);
    if (meta?.provider_name) embed.setFooter({ text: meta.provider_name });

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

export default watch;
