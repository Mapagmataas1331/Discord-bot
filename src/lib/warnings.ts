import { lazyStatement } from "./db.js";

export interface Warning {
  id: number;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: number;
}

interface WarningRow {
  id: number;
  user_id: string;
  moderator_id: string;
  reason: string;
  created_at: number;
}

const insert = lazyStatement(
  "INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)",
);
const selectForUser = lazyStatement(
  "SELECT id, user_id, moderator_id, reason, created_at FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC",
);
const countForUser = lazyStatement("SELECT COUNT(*) AS n FROM warnings WHERE guild_id = ? AND user_id = ?");
const deleteForUser = lazyStatement("DELETE FROM warnings WHERE guild_id = ? AND user_id = ?");
const selectOne = lazyStatement(
  "SELECT id, user_id, moderator_id, reason, created_at FROM warnings WHERE guild_id = ? AND id = ?",
);
const deleteOne = lazyStatement("DELETE FROM warnings WHERE guild_id = ? AND id = ?");

function toWarning(row: WarningRow): Warning {
  return {
    id: Number(row.id),
    userId: row.user_id,
    moderatorId: row.moderator_id,
    reason: row.reason,
    createdAt: Number(row.created_at),
  };
}

export function addWarning(guildId: string, userId: string, moderatorId: string, reason: string): number {
  const result = insert().run(guildId, userId, moderatorId, reason, Date.now());
  return Number(result.lastInsertRowid);
}

export function listWarnings(guildId: string, userId: string): Warning[] {
  return (selectForUser().all(guildId, userId) as unknown as WarningRow[]).map(toWarning);
}

export function countWarnings(guildId: string, userId: string): number {
  const row = countForUser().get(guildId, userId) as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function clearWarnings(guildId: string, userId: string): number {
  return Number(deleteForUser().run(guildId, userId).changes);
}

/** Removes one warning by id; returns it, or null if not found in this guild. */
export function removeWarning(guildId: string, id: number): Warning | null {
  const row = selectOne().get(guildId, id) as WarningRow | undefined;
  if (!row) return null;
  deleteOne().run(guildId, id);
  return toWarning(row);
}
