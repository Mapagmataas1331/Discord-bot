/**
 * SQLite storage using Node's built-in `node:sqlite` (Node >= 22.13, no native build step,
 * works the same on Windows x64 and Linux ARM64).
 */
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import { config } from "../config.js";

let instance: DatabaseSync | undefined;

/** Ordered schema migrations. Append new entries; never edit old ones. */
const migrations: readonly string[] = [
  // 1: per-guild settings + admin roles
  `
  CREATE TABLE guild_settings (
    guild_id            TEXT PRIMARY KEY,
    cmd_channel_id      TEXT,
    welcome_channel_id  TEXT,
    welcome_message     TEXT,
    auto_role_id        TEXT,
    mod_log_channel_id  TEXT
  );
  CREATE TABLE admin_roles (
    guild_id  TEXT NOT NULL,
    role_id   TEXT NOT NULL,
    PRIMARY KEY (guild_id, role_id)
  );
  `,
  // 2: moderation warnings + persisted reminders
  `
  CREATE TABLE warnings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    moderator_id  TEXT NOT NULL,
    reason        TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX idx_warnings_guild_user ON warnings (guild_id, user_id);
  CREATE TABLE reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    message     TEXT NOT NULL,
    due_at      INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX idx_reminders_due ON reminders (due_at);
  CREATE INDEX idx_reminders_user ON reminders (guild_id, user_id);
  `,
  // 3: music DJ role
  `
  ALTER TABLE guild_settings ADD COLUMN dj_role_id TEXT;
  `,
  // 4: rules gate (channel with the "I agree" button, linked from the welcome message)
  `
  ALTER TABLE guild_settings ADD COLUMN gate_channel_id TEXT;
  `,
];

function migrate(db: DatabaseSync): void {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined;
  const current = row?.user_version ?? 0;
  for (let version = current; version < migrations.length; version++) {
    db.exec("BEGIN");
    try {
      db.exec(migrations[version] ?? "");
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
      console.log(`🗄️ Applied database migration ${version + 1}`);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

/**
 * Opens the database on first use (so e.g. deploy-commands never touches it).
 * Loaded via getBuiltinModule to avoid the ExperimentalWarning unless the DB is actually used.
 */
export function getDb(): DatabaseSync {
  if (instance) return instance;
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
  const dbPath = path.resolve(config.dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  console.log(`🗄️ Database ready at ${dbPath}`);
  instance = db;
  return db;
}

/** A prepared statement that is compiled the first time it is used. */
export function lazyStatement(sql: string): () => StatementSync {
  let statement: StatementSync | undefined;
  return () => (statement ??= getDb().prepare(sql));
}

export function closeDb(): void {
  if (instance?.isOpen) instance.close();
  instance = undefined;
}
