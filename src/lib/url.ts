import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

function isBlockedAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped?.[1]) return blocked.check(mapped[1], "ipv4");
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) return blocked.check(address, "ipv6");
  return true;
}

export function looksLikeUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

/**
 * Validates that a user-supplied URL is http(s) and points at a public internet host
 * (blocks localhost/private ranges so the bot or Lavalink can't be used to probe the server).
 * Returns the parsed URL, or an error message.
 */
export async function checkPublicUrl(raw: string): Promise<URL | string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "That doesn't look like a valid link.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Only http(s) links are supported.";
  if (url.username || url.password) return "Links with credentials aren't allowed.";

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "That host isn't allowed.";
  }
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      return "That host isn't allowed.";
    }
  } catch {
    return "I couldn't resolve that link's host.";
  }
  return url;
}
