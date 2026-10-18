/**
 * Per-guild bot settings, persisted in SQLite.
 */
import { db } from "./db.js";

export interface GuildSettings {
  cmdChannelId: string | null;
  adminRoleIds: string[];
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  autoRoleId: string | null;
  modLogChannelId: string | null;
}

export type SettingKey = Exclude<keyof GuildSettings, "adminRoleIds">;

/** Whitelisted column names: never interpolate user input into SQL. */
const COLUMNS: Record<SettingKey, string> = {
  cmdChannelId: "cmd_channel_id",
  welcomeChannelId: "welcome_channel_id",
  welcomeMessage: "welcome_message",
  autoRoleId: "auto_role_id",
  modLogChannelId: "mod_log_channel_id",
};

interface SettingsRow {
  cmd_channel_id: string | null;
  welcome_channel_id: string | null;
  welcome_message: string | null;
  auto_role_id: string | null;
  mod_log_channel_id: string | null;
}

const selectSettings = db.prepare(
  "SELECT cmd_channel_id, welcome_channel_id, welcome_message, auto_role_id, mod_log_channel_id FROM guild_settings WHERE guild_id = ?",
);
const selectAdminRoles = db.prepare("SELECT role_id FROM admin_roles WHERE guild_id = ? ORDER BY rowid");
const insertAdminRole = db.prepare("INSERT OR IGNORE INTO admin_roles (guild_id, role_id) VALUES (?, ?)");
const deleteAdminRole = db.prepare("DELETE FROM admin_roles WHERE guild_id = ? AND role_id = ?");

const upserts = Object.fromEntries(
  Object.entries(COLUMNS).map(([key, column]) => [
    key,
    db.prepare(
      `INSERT INTO guild_settings (guild_id, ${column}) VALUES (?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET ${column} = excluded.${column}`,
    ),
  ]),
) as Record<SettingKey, ReturnType<typeof db.prepare>>;

export function getSettings(guildId: string): GuildSettings {
  const row = selectSettings.get(guildId) as SettingsRow | undefined;
  const roles = selectAdminRoles.all(guildId) as unknown as Array<{ role_id: string }>;
  return {
    cmdChannelId: row?.cmd_channel_id ?? null,
    adminRoleIds: roles.map((r) => r.role_id),
    welcomeChannelId: row?.welcome_channel_id ?? null,
    welcomeMessage: row?.welcome_message ?? null,
    autoRoleId: row?.auto_role_id ?? null,
    modLogChannelId: row?.mod_log_channel_id ?? null,
  };
}

export function setSetting(guildId: string, key: SettingKey, value: string | null): void {
  upserts[key].run(guildId, value);
}

export function setCmdChannel(guildId: string, channelId: string | null): void {
  setSetting(guildId, "cmdChannelId", channelId);
}

/** Returns false if the role was already an admin role. */
export function addAdminRole(guildId: string, roleId: string): boolean {
  return Number(insertAdminRole.run(guildId, roleId).changes) > 0;
}

/** Returns false if the role was not an admin role. */
export function removeAdminRole(guildId: string, roleId: string): boolean {
  return Number(deleteAdminRole.run(guildId, roleId).changes) > 0;
}
