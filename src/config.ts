import "dotenv/config";

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function flag(name: string, fallback: boolean): boolean {
  const value = optional(name);
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const config = {
  token: optional("DISCORD_TOKEN"),
  clientId: optional("CLIENT_ID"),
  devGuildId: optional("DEV_GUILD_ID"),
  port: optional("PORT"),
  botNickname: optional("BOT_NICKNAME"),
};
