/**
 * Self-serve data export (GET /api/account/export).
 *
 * JSON: everything the user owns — profile (no password hash), tanks, entries
 * (with `data` parsed), inhabitants, reminders and notification settings.
 * CSV: one tank's entries, with the common `data` fields flattened into columns
 * and the full original `data` kept in `raw_json`.
 */
import pkg from "@/package.json";

export const APP_VERSION = pkg.version;

function parseData(value) {
  if (value == null || value === "") return {};
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return { _unparsed: value };
  }
}

export async function buildJsonExport(db, user) {
  const [
    { results: tanks },
    { results: entries },
    { results: inhabitants },
    { results: reminders },
    { results: settingsRows },
  ] = await db.batch([
    db.prepare(`SELECT * FROM tanks WHERE user_id = ? ORDER BY created_at ASC, id ASC`).bind(user.id),
    db
      .prepare(
        `SELECT e.* FROM entries e JOIN tanks t ON t.id = e.tank_id
         WHERE t.user_id = ? ORDER BY e.date ASC, e.time ASC, e.created_at ASC, e.id ASC`
      )
      .bind(user.id),
    db
      .prepare(
        `SELECT i.* FROM inhabitants i JOIN tanks t ON t.id = i.tank_id
         WHERE t.user_id = ? ORDER BY i.date_added ASC, i.id ASC`
      )
      .bind(user.id),
    db.prepare(`SELECT * FROM reminders WHERE user_id = ? ORDER BY due_date ASC, id ASC`).bind(user.id),
    db
      .prepare(`SELECT timezone, reminders_email, digest_hour, unsubscribed_at FROM user_settings WHERE user_id = ?`)
      .bind(user.id),
  ]);

  const byTank = new Map(
    tanks.map((t) => [t.id, { ...t, is_public: !!t.is_public, entries: [], inhabitants: [], reminders: [] }])
  );
  for (const e of entries) byTank.get(e.tank_id)?.entries.push({ ...e, data: parseData(e.data) });
  for (const i of inhabitants) byTank.get(i.tank_id)?.inhabitants.push(i);
  for (const r of reminders) byTank.get(r.tank_id)?.reminders.push(r);

  return {
    exported_at: new Date().toISOString(),
    app_version: APP_VERSION,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      created_at: user.created_at,
    },
    notification_settings: settingsRows[0] ?? null,
    tanks: [...byTank.values()],
  };
}

// Flattened entry columns: [csv header, key in entry.data].
const DATA_COLUMNS = [
  // parameters
  ["temp", "temp"],
  ["ph", "ph"],
  ["ammonia", "ammonia"],
  ["nitrite", "nitrite"],
  ["nitrate", "nitrate"],
  ["gh", "gh"],
  ["kh", "kh"],
  ["water_change", "waterChange"],
  ["water_change_pct", "waterChangePct"],
  // changes
  ["change_type", "changeType"],
  ["subject", "subject"],
  ["quantity", "quantity"],
  // medical
  ["fish", "fish"],
  ["count", "count"],
  ["symptoms", "symptoms"],
  ["treatment", "treatment"],
  ["date_in", "dateIn"],
  ["date_out", "dateOut"],
  ["outcome", "outcome"],
  // co2
  ["co2_status", "status"],
  ["bubble_rate", "bubbleRate"],
  ["drop_checker", "dropChecker"],
  ["timer_hours", "timerHours"],
  ["timer_start", "timerStart"],
  ["timer_stop", "timerStop"],
];

const CSV_HEADER = [
  "id",
  "date",
  "time",
  "type",
  "note",
  ...DATA_COLUMNS.map(([h]) => h),
  "created_at",
  "raw_json",
];

function csvCell(value) {
  if (value == null) return "";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Spreadsheet formula injection guard: a text cell starting with = + - @ (or a
  // tab/CR) is prefixed with ' so Excel/Sheets treat it as text. Plain numbers
  // such as "-1.5" are left alone.
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function entriesToCsv(entries) {
  const lines = [CSV_HEADER.join(",")];
  for (const e of entries) {
    const data = parseData(e.data);
    const row = [
      e.id,
      e.date,
      e.time,
      e.type,
      e.note,
      ...DATA_COLUMNS.map(([, key]) => data?.[key]),
      e.created_at,
      typeof e.data === "string" ? e.data : JSON.stringify(e.data ?? {}),
    ];
    lines.push(row.map(csvCell).join(","));
  }
  // Leading BOM so Excel opens UTF-8 (°, ₂, emoji in notes) correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** "Living Room 75g" -> "living-room-75g" (falls back to "tank-<id>"). */
export function fileSlug(tank) {
  const base = String(tank.slug || tank.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || `tank-${tank.id}`;
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
