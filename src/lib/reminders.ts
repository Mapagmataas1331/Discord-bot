import type { Client } from "discord.js";
import { lazyStatement } from "./db.js";

export const MAX_REMINDERS_PER_USER = 25;

export interface Reminder {
  id: number;
  guildId: string;
  channelId: string;
  userId: string;
  message: string;
  dueAt: number;
}

interface ReminderRow {
  id: number;
  guild_id: string;
  channel_id: string;
  user_id: string;
  message: string;
  due_at: number;
}

const insert = lazyStatement(
  "INSERT INTO reminders (guild_id, channel_id, user_id, message, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
);
const selectForUser = lazyStatement(
  "SELECT id, guild_id, channel_id, user_id, message, due_at FROM reminders WHERE guild_id = ? AND user_id = ? ORDER BY due_at",
);
const countForUser = lazyStatement("SELECT COUNT(*) AS n FROM reminders WHERE guild_id = ? AND user_id = ?");
const deleteForUser = lazyStatement("DELETE FROM reminders WHERE id = ? AND guild_id = ? AND user_id = ?");
const selectDue = lazyStatement(
  "SELECT id, guild_id, channel_id, user_id, message, due_at FROM reminders WHERE due_at <= ? ORDER BY due_at LIMIT 50",
);
const deleteById = lazyStatement("DELETE FROM reminders WHERE id = ?");

function toReminder(row: ReminderRow): Reminder {
  return {
    id: Number(row.id),
    guildId: row.guild_id,
    channelId: row.channel_id,
    userId: row.user_id,
    message: row.message,
    dueAt: Number(row.due_at),
  };
}

export function addReminder(r: Omit<Reminder, "id">): number {
  return Number(insert().run(r.guildId, r.channelId, r.userId, r.message, r.dueAt, Date.now()).lastInsertRowid);
}

export function listReminders(guildId: string, userId: string): Reminder[] {
  return (selectForUser().all(guildId, userId) as unknown as ReminderRow[]).map(toReminder);
}

export function countReminders(guildId: string, userId: string): number {
  const row = countForUser().get(guildId, userId) as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function cancelReminder(id: number, guildId: string, userId: string): boolean {
  return Number(deleteForUser().run(id, guildId, userId).changes) > 0;
}

async function deliver(client: Client, reminder: Reminder): Promise<void> {
  const content = `⏰ <@${reminder.userId}>, reminder: ${reminder.message}`;
  try {
    const channel = await client.channels.fetch(reminder.channelId);
    if (channel?.isSendable()) {
      await channel.send({ content, allowedMentions: { users: [reminder.userId] } });
      return;
    }
  } catch {
    // fall through to DM
  }
  try {
    const user = await client.users.fetch(reminder.userId);
    await user.send(`⏰ Reminder: ${reminder.message}`);
  } catch (error) {
    console.warn(`⚠️ Could not deliver reminder ${reminder.id}:`, error);
  }
}

let running = false;

/** Polls the database for due reminders. Survives restarts because state lives in SQLite. */
export function startReminderScheduler(client: Client, intervalMs = 15_000): NodeJS.Timeout {
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const due = (selectDue().all(Date.now()) as unknown as ReminderRow[]).map(toReminder);
      for (const reminder of due) {
        deleteById().run(reminder.id); // delete first so a crash never double-sends
        await deliver(client, reminder);
      }
    } catch (error) {
      console.error("❌ Reminder scheduler error:", error);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(() => void tick(), intervalMs);
}
