/**
 * Reminder data access + state transitions. Every function takes the D1 `db` as a
 * parameter (never imports lib/db.js) so Pages routes and the reminders Worker share it.
 */

import { addDays, maxDate, isValidTimeZone } from "./dates.js";
import { TASK_TYPES, TASK_TYPE_KEYS, AUTO_TASK_TYPES, taskTypesForEntry, lastDoneSql, reminderTitle } from "./match.js";

export const SNOOZE_DAYS = [1, 3, 7];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── User settings ───────────────────────────────────────────────────────────

export const SETTINGS_DEFAULTS = { timezone: "UTC", reminders_email: 1, digest_hour: 8, unsubscribed_at: null };

/** Settings with defaults applied; `has_row` tells whether the user ever saved/captured any. */
export async function getUserSettings(db, userId) {
  const row = await db
    .prepare(`SELECT timezone, reminders_email, digest_hour, unsubscribed_at, updated_at FROM user_settings WHERE user_id = ?`)
    .bind(userId)
    .first();
  return {
    timezone: row?.timezone || SETTINGS_DEFAULTS.timezone,
    reminders_email: row ? row.reminders_email : SETTINGS_DEFAULTS.reminders_email,
    digest_hour: row ? row.digest_hour : SETTINGS_DEFAULTS.digest_hour,
    unsubscribed_at: row?.unsubscribed_at ?? null,
    has_row: !!row,
  };
}

/** Silently records the browser timezone the first time we learn it (never overwrites). */
export async function captureTimezone(db, userId, timezone) {
  if (!isValidTimeZone(timezone)) return;
  await db
    .prepare(`INSERT INTO user_settings (user_id, timezone) VALUES (?, ?) ON CONFLICT(user_id) DO NOTHING`)
    .bind(userId, timezone)
    .run();
}

/** Validates + upserts { timezone?, reminders_email?, digest_hour? }. Re-enabling email clears unsubscribed_at. */
export async function saveUserSettings(db, userId, body) {
  const cur = await getUserSettings(db, userId);
  const next = { ...cur };
  if ("timezone" in body) {
    if (!isValidTimeZone(body.timezone)) return { error: "Unknown timezone" };
    next.timezone = body.timezone;
  }
  if ("digest_hour" in body) {
    const h = Number(body.digest_hour);
    if (!Number.isInteger(h) || h < 0 || h > 23) return { error: "digest_hour must be 0–23" };
    next.digest_hour = h;
  }
  if ("reminders_email" in body) next.reminders_email = body.reminders_email ? 1 : 0;
  const unsubscribed_at = next.reminders_email ? null : cur.unsubscribed_at;
  await db
    .prepare(
      `INSERT INTO user_settings (user_id, timezone, reminders_email, digest_hour, unsubscribed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET timezone = excluded.timezone, reminders_email = excluded.reminders_email,
         digest_hour = excluded.digest_hour, unsubscribed_at = excluded.unsubscribed_at, updated_at = excluded.updated_at`
    )
    .bind(userId, next.timezone, next.reminders_email, next.digest_hour, unsubscribed_at)
    .run();
  return { settings: await getUserSettings(db, userId) };
}

export async function unsubscribeUser(db, userId) {
  await db
    .prepare(
      `INSERT INTO user_settings (user_id, reminders_email, unsubscribed_at, updated_at)
       VALUES (?, 0, datetime('now'), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET reminders_email = 0,
         unsubscribed_at = COALESCE(user_settings.unsubscribed_at, datetime('now')), updated_at = datetime('now')`
    )
    .bind(userId)
    .run();
}

// ── Reading ─────────────────────────────────────────────────────────────────

export async function getReminder(db, id) {
  return db.prepare(`SELECT * FROM reminders WHERE id = ?`).bind(id).first();
}

/** Reminder owned by `user` (a session row with user_id), else a 404-shaped error. */
export async function loadOwnReminder(db, id, user) {
  const reminder = await getReminder(db, id);
  if (!reminder || reminder.user_id !== user.user_id) return { error: "Reminder not found", status: 404 };
  return { reminder };
}

/** Active + paused reminders for a tank (completed one-offs are hidden). */
export async function listTankReminders(db, tankId, userId) {
  const { results } = await db
    .prepare(
      `SELECT * FROM reminders WHERE tank_id = ? AND user_id = ? AND status != 'completed'
       ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, due_date ASC, id ASC`
    )
    .bind(tankId, userId)
    .all();
  return results;
}

/** Active reminders across all of a user's tanks, soonest first, with tank names. */
export async function listUserReminders(db, userId, { dueOnOrBefore = null, limit = 100 } = {}) {
  const { results } = await db
    .prepare(
      `SELECT r.*, t.name AS tank_name FROM reminders r JOIN tanks t ON t.id = r.tank_id
       WHERE r.user_id = ? AND r.status = 'active' ${dueOnOrBefore ? "AND r.due_date <= ?" : ""}
       ORDER BY r.due_date ASC, t.name ASC, r.id ASC LIMIT ?`
    )
    .bind(...(dueOnOrBefore ? [userId, dueOnOrBefore, limit] : [userId, limit]))
    .all();
  return results;
}

/** Latest matching journal entry date per tank and task type. → { [tankId]: { water_change: "YYYY-MM-DD", … } } */
export async function lastDoneByTank(db, tankIds) {
  const ids = [...new Set((tankIds || []).map(Number).filter(Number.isInteger))];
  const out = Object.fromEntries(ids.map((id) => [id, {}]));
  if (ids.length === 0) return out;
  const ph = ids.map(() => "?").join(", ");
  const binds = AUTO_TASK_TYPES.flatMap(() => ids);
  const { results } = await db.prepare(lastDoneSql(ph)).bind(...binds).all();
  for (const r of results) if (r.last_date) out[r.tank_id][r.task_type] = r.last_date;
  return out;
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates create/update input. For create, task_type and due_date are required.
 * @returns {{ values: object } | { error: string }}
 */
export function validateReminderInput(body, { partial = false, current = null } = {}) {
  const v = {};
  const has = (k) => body && Object.prototype.hasOwnProperty.call(body, k);

  if (has("task_type") || !partial) {
    if (!TASK_TYPE_KEYS.includes(body?.task_type)) return { error: `task_type must be one of: ${TASK_TYPE_KEYS.join(", ")}` };
    v.task_type = body.task_type;
  }
  if (has("title")) {
    const t = body.title == null ? "" : String(body.title).trim();
    if (t.length > 80) return { error: "title must be 80 characters or fewer" };
    v.title = t || null;
  }
  const taskType = v.task_type ?? current?.task_type;
  const title = has("title") ? v.title : current?.title;
  if (taskType === "custom" && !title) return { error: "A title is required for custom reminders" };

  if (has("interval_days") || !partial) {
    const raw = body?.interval_days;
    if (raw == null || raw === "") v.interval_days = null;
    else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 365) return { error: "interval_days must be a whole number from 1 to 365" };
      v.interval_days = n;
    }
  }
  if (has("due_date") || !partial) {
    if (!DATE_RE.test(body?.due_date ?? "")) return { error: "due_date must be YYYY-MM-DD" };
    v.due_date = body.due_date;
  }
  if (has("auto_reset")) v.auto_reset = body.auto_reset ? 1 : 0;
  else if (!partial) v.auto_reset = taskType === "custom" ? 0 : 1;
  if (has("status")) {
    if (!["active", "paused"].includes(body.status)) return { error: "status must be active or paused" };
    v.status = body.status;
  }
  return { values: v };
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function createReminder(db, { userId, tankId, values }) {
  const { meta } = await db
    .prepare(
      `INSERT INTO reminders (user_id, tank_id, task_type, title, interval_days, due_date, auto_reset)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, tankId, values.task_type, values.title ?? null, values.interval_days, values.due_date, values.auto_reset)
    .run();
  return getReminder(db, meta.last_row_id);
}

export async function updateReminder(db, reminder, values) {
  const updates = { ...values };
  if ("due_date" in updates && updates.due_date !== reminder.due_date) {
    // A new due date starts a fresh nag cycle.
    updates.notify_count = 0;
    updates.last_notified_on = null;
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) return reminder;
  await db
    .prepare(`UPDATE reminders SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...keys.map((k) => updates[k]), reminder.id)
    .run();
  return getReminder(db, reminder.id);
}

export async function deleteReminder(db, reminder) {
  await db.batch([
    db.prepare(`DELETE FROM reminder_log WHERE reminder_id = ?`).bind(reminder.id),
    db.prepare(`DELETE FROM reminders WHERE id = ?`).bind(reminder.id),
  ]);
}

function logStmt(db, { reminderId, action, source, entryId = null, prev = null, next = null }) {
  return db
    .prepare(`INSERT INTO reminder_log (reminder_id, action, source, entry_id, prev_due_date, new_due_date) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(reminderId, action, source, entryId, prev, next);
}

/**
 * Marks a reminder done on local date `date`.
 * Recurring → due = date + interval (never earlier than tomorrow-relative-to-date); one-off → completed.
 * `expectDue` (from a signed email link) makes the update conditional so a stale link is a no-op.
 * @returns {Promise<{ reminder, completed: boolean, changed: boolean }>}
 */
export async function markDone(db, reminder, { date, source = "app", entryId = null, expectDue = null }) {
  const lastDone = maxDate(reminder.last_done_on, date);
  const guard = expectDue ? ` AND due_date = ?` : "";
  const guardBind = expectDue ? [expectDue] : [];
  let stmt, action, next;
  if (reminder.interval_days) {
    next = addDays(date, reminder.interval_days);
    action = "done";
    stmt = db
      .prepare(
        `UPDATE reminders SET due_date = ?, last_done_on = ?, notify_count = 0, last_notified_on = NULL,
           status = 'active', updated_at = datetime('now') WHERE id = ?${guard}`
      )
      .bind(next, lastDone, reminder.id, ...guardBind);
  } else {
    next = null;
    action = "completed";
    stmt = db
      .prepare(`UPDATE reminders SET status = 'completed', last_done_on = ?, updated_at = datetime('now') WHERE id = ?${guard}`)
      .bind(lastDone, reminder.id, ...guardBind);
  }
  const res = await stmt.run();
  const changed = (res?.meta?.changes ?? 0) > 0;
  if (changed) {
    await logStmt(db, { reminderId: reminder.id, action, source, entryId, prev: reminder.due_date, next: next ?? reminder.due_date }).run();
  }
  return { reminder: await getReminder(db, reminder.id), completed: !reminder.interval_days, changed };
}

/** Pushes the due date to max(due, today) + days. Doesn't touch last_done_on. */
export async function snooze(db, reminder, { days, today, source = "app", expectDue = null }) {
  if (!SNOOZE_DAYS.includes(Number(days))) throw new Error("snooze days must be 1, 3 or 7");
  const next = addDays(maxDate(reminder.due_date, today), Number(days));
  const guard = expectDue ? ` AND due_date = ?` : "";
  const { meta } = await db
    .prepare(
      `UPDATE reminders SET due_date = ?, notify_count = 0, last_notified_on = NULL, updated_at = datetime('now')
       WHERE id = ?${guard}`
    )
    .bind(next, reminder.id, ...(expectDue ? [expectDue] : []))
    .run();
  const changed = (meta?.changes ?? 0) > 0;
  if (changed) await logStmt(db, { reminderId: reminder.id, action: "snoozed", source, prev: reminder.due_date, next }).run();
  return { reminder: await getReminder(db, reminder.id), changed };
}

/**
 * Auto-reset: called after a journal entry is created or edited. For each active,
 * auto_reset reminder on the tank whose task the entry satisfies, and only if the
 * entry is newer than last_done_on, move the due date FORWARD to entry.date + interval
 * (one-offs complete). Never throws — a reminder problem must not fail the entry save.
 *
 * @returns {Promise<Array<{ reminder_id, task_type, title, new_due_date, completed }>>}
 */
export async function autoResetFromEntry(db, { userId, tankId, entry }) {
  try {
    const types = taskTypesForEntry(entry);
    if (types.length === 0 || !DATE_RE.test(entry?.date ?? "")) return [];
    const ph = types.map(() => "?").join(", ");
    const { results } = await db
      .prepare(
        `SELECT * FROM reminders WHERE tank_id = ? AND user_id = ? AND status = 'active' AND auto_reset = 1
         AND task_type IN (${ph})`
      )
      .bind(tankId, userId, ...types)
      .all();

    const resets = [];
    for (const r of results) {
      if (r.last_done_on && entry.date <= r.last_done_on) continue;
      if (!r.interval_days) {
        const { changed } = await markDone(db, r, { date: entry.date, source: "entry", entryId: entry.id ?? null });
        if (changed) resets.push({ reminder_id: r.id, task_type: r.task_type, title: reminderTitle(r), new_due_date: null, completed: true });
        continue;
      }
      const next = addDays(entry.date, r.interval_days);
      if (next <= r.due_date) {
        // Back-filled entry: record it as the latest completion but never pull the due date earlier.
        await db.prepare(`UPDATE reminders SET last_done_on = ?, updated_at = datetime('now') WHERE id = ?`).bind(entry.date, r.id).run();
        continue;
      }
      await db.batch([
        db
          .prepare(
            `UPDATE reminders SET due_date = ?, last_done_on = ?, notify_count = 0, last_notified_on = NULL,
               updated_at = datetime('now') WHERE id = ?`
          )
          .bind(next, entry.date, r.id),
        logStmt(db, { reminderId: r.id, action: "auto_reset", source: "entry", entryId: entry.id ?? null, prev: r.due_date, next }),
      ]);
      resets.push({ reminder_id: r.id, task_type: r.task_type, title: reminderTitle(r), new_due_date: next, completed: false });
    }
    return resets;
  } catch (err) {
    console.error("autoResetFromEntry failed:", err?.message);
    return [];
  }
}

/**
 * Creates the journal entry that corresponds to completing a reminder (email "Also add
 * to journal"). Returns the new entry row, or null for task types with no natural entry.
 */
export async function createEntryForReminder(db, reminder, { date, time }) {
  let type, data;
  switch (reminder.task_type) {
    case "water_change": type = "parameters"; data = { waterChange: true }; break;
    case "filter_clean": type = "parameters"; data = { filterCleaned: true }; break;
    case "fertilizer":   type = "changes";    data = { changeType: "Fertilized", subject: "" }; break;
    default: return null;
  }
  const { meta } = await db
    .prepare(`INSERT INTO entries (tank_id, type, date, time, data, note) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(reminder.tank_id, type, date, time, JSON.stringify(data), "Logged from a reminder email.")
    .run();
  return db.prepare(`SELECT * FROM entries WHERE id = ?`).bind(meta.last_row_id).first();
}

export { TASK_TYPES };
