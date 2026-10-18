/**
 * Per-guild bot settings. In-memory for now (lost on restart).
 */
export interface GuildSettings {
  cmdChannelId: string | null;
  adminRoleIds: string[];
}

const store = new Map<string, GuildSettings>();

export function getSettings(guildId: string): GuildSettings {
  const existing = store.get(guildId);
  if (existing) return existing;
  const fresh: GuildSettings = { cmdChannelId: null, adminRoleIds: [] };
  store.set(guildId, fresh);
  return fresh;
}

export function setCmdChannel(guildId: string, channelId: string | null): void {
  getSettings(guildId).cmdChannelId = channelId;
}

/** Returns false if the role was already an admin role. */
export function addAdminRole(guildId: string, roleId: string): boolean {
  const settings = getSettings(guildId);
  if (settings.adminRoleIds.includes(roleId)) return false;
  settings.adminRoleIds.push(roleId);
  return true;
}

/** Returns false if the role was not an admin role. */
export function removeAdminRole(guildId: string, roleId: string): boolean {
  const settings = getSettings(guildId);
  const before = settings.adminRoleIds.length;
  settings.adminRoleIds = settings.adminRoleIds.filter((id) => id !== roleId);
  return settings.adminRoleIds.length !== before;
}
