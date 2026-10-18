/**
 * SQLite storage using Node's built-in `node:sqlite` (Node >= 22.13, no native build step,
 * works the same on Windows x64 and Linux ARM64).
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config.js";

const dbPath = path.resolve(config.dbPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

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
];

function migrate(): void {
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

migrate();
console.log(`🗄️ Database ready at ${dbPath}`);

export function closeDb(): void {
  if (db.isOpen) db.close();
}
