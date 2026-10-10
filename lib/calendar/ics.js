/**
 * iCalendar (RFC 5545) output for reminders. Pure — no DB, no env, no crypto —
 * so it runs on Pages (edge), in node --test and in the browser.
 *
 *   buildReminderFeed({ reminders, timezone, today, origin, now, lastDone })  → subscription feed
 *   buildReminderIcs(reminder, { today, origin, now, lastDone })              → one-event download
 *
 * Design decisions:
 * - One all-day VEVENT per active reminder, on its NEXT due date. No RRULE: a due date
 *   moves whenever the task is logged (auto-reset, Done, Snooze), so the feed always
 *   describes the current next occurrence and calendar clients pick up the move on
 *   their next refresh.
 * - Overdue: an overdue reminder stays on its (past) due date, so the calendar shows
 *   when it was due. Its SUMMARY gets an "Overdue: " prefix when the due date is before
 *   `today` (the user's local date at feed generation). Because the event moves as soon
 *   as the task is done, a past-dated event is always genuinely overdue; the prefix can
 *   only lag (appear late) by the client's refresh interval, never be wrong. Due-today
 *   reminders get no prefix.
 * - UID: "reminder-<id>@aquaslog.com" in the feed (stable, so a moved due date updates
 *   the same event). Single-event downloads use "reminder-<id>-<YYYYMMDD>@aquaslog.com"
 *   so importing a download never collides with the subscribed copy (Google skips
 *   imports whose UID already exists in any of the user's calendars).
 * - SEQUENCE / LAST-MODIFIED come from reminders.updated_at, which changes on every
 *   edit / Done / Snooze / auto-reset (and not on digest bookkeeping).
 * - VALARM: display alarm at 09:00 local on the day (TRIGGER;RELATED=START:PT9H on an
 *   all-day event). Some clients drop alarms from subscribed calendars by default.
 */

import { addDays, fmtInterval } from "../reminders/dates.js";
import { TASK_TYPES, reminderTitle } from "../reminders/match.js";

export const UID_DOMAIN = "aquaslog.com";
export const PRODID = "-//AquaSlog//Reminders 1.1//EN";
export const CALENDAR_NAME = "AquaSlog reminders";
export const REFRESH_INTERVAL = "PT6H";
export const ALARM_TRIGGER = "PT9H";
const SEQUENCE_EPOCH = Date.UTC(2026, 0, 1); // reminders shipped in 2026; keeps SEQUENCE small

const CRLF = "\r\n";
const enc = new TextEncoder();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Primitives ──────────────────────────────────────────────────────────────

/** Escapes a TEXT value (RFC 5545 §3.3.11): \ ; , and newlines; strips other control chars. */
export function escapeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Folds a content line to at most 75 octets per physical line (RFC 5545 §3.1):
 * continuation lines start with a single space. Never splits a UTF-8 sequence.
 */
export function foldLine(line) {
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75; // the first line; continuation lines carry the leading space
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (curBytes + n > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
      limit = 74;
    }
    cur += ch;
    curBytes += n;
  }
  out.push(cur);
  return out.join(`${CRLF} `);
}

/** "2026-10-09" → "20261009" (DATE value). */
export function icsDate(dateStr) {
  if (!DATE_RE.test(dateStr ?? "")) throw new Error(`icsDate: bad date ${dateStr}`);
  return dateStr.replace(/-/g, "");
}

/** Parses D1 "YYYY-MM-DD HH:MM:SS" (UTC), ISO strings, Dates or ms. Returns ms or null. */
export function parseUtc(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const s = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s.replace(" ", "T")}Z` : s;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** UTC DATE-TIME: "20261009T140501Z". */
export function icsDateTime(value) {
  const ms = parseUtc(value);
  if (ms == null) throw new Error(`icsDateTime: bad timestamp ${value}`);
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Monotonic revision number derived from updated_at (seconds since 2026-01-01Z). */
export function sequenceFrom(updatedAt) {
  const ms = parseUtc(updatedAt);
  if (ms == null) return 0;
  return Math.max(0, Math.floor((ms - SEQUENCE_EPOCH) / 1000));
}

/** Content line "NAME;PARAMS:value" (value already escaped as needed), folded. */
function prop(name, value) {
  return foldLine(`${name}:${value}`);
}

/** Serializes [[name, value], …] / nested component arrays into CRLF-terminated text. */
function serialize(lines) {
  return lines.join(CRLF) + CRLF;
}

// ── Reminder → event ────────────────────────────────────────────────────────

function longDate(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Tank page URL for a reminder. */
export function tankUrl(origin, tankId) {
  return `${String(origin || `https://${UID_DOMAIN}`).replace(/\/+$/, "")}/tanks/${tankId}`;
}

/**
 * Plain-text event fields for a reminder row ({ id, tank_id, tank_name, task_type, title,
 * interval_days, due_date, auto_reset, last_done_on, created_at, updated_at }).
 * `lastDone` is the best-known last completion date (journal entries or Done), or null.
 */
export function reminderEventFields(r, { today, origin, lastDone = null } = {}) {
  const title = reminderTitle(r);
  const overdue = !!today && r.due_date < today;
  const summary = `${overdue ? "Overdue: " : ""}${title} · ${r.tank_name}`;
  const meta = TASK_TYPES[r.task_type] ?? TASK_TYPES.custom;
  const url = tankUrl(origin, r.tank_id);

  const lines = [];
  if (r.interval_days) {
    lines.push(
      r.auto_reset
        ? `Every ${fmtInterval(r.interval_days)}. Logging it in your AquaSlog journal moves this to the next due date.`
        : `Every ${fmtInterval(r.interval_days)}. Mark it done in AquaSlog to move this to the next due date.`
    );
  } else {
    lines.push("One-time reminder.");
  }
  const last = lastDone || r.last_done_on;
  if (last) lines.push(`${meta.lastLabel || "Last done"}: ${longDate(last)}.`);
  else if (meta.lastLabel) lines.push(`${meta.lastLabel}: none logged yet.`);
  lines.push("", `Open ${r.tank_name}: ${url}`);

  return { title, summary, overdue, description: lines.join("\n"), url };
}

/** VEVENT content lines for a reminder. */
export function reminderVEvent(r, { today, origin, now = new Date(), lastDone = null, uid } = {}) {
  const f = reminderEventFields(r, { today, origin, lastDone });
  const updated = r.updated_at || r.created_at;
  const lines = [
    "BEGIN:VEVENT",
    prop("UID", uid || `reminder-${r.id}@${UID_DOMAIN}`),
    prop("DTSTAMP", icsDateTime(now)),
    prop("DTSTART;VALUE=DATE", icsDate(r.due_date)),
    prop("DTEND;VALUE=DATE", icsDate(addDays(r.due_date, 1))),
    prop("SUMMARY", escapeText(f.summary)),
    prop("DESCRIPTION", escapeText(f.description)),
    prop("URL", f.url),
  ];
  if (r.created_at && parseUtc(r.created_at) != null) lines.push(prop("CREATED", icsDateTime(r.created_at)));
  if (updated && parseUtc(updated) != null) lines.push(prop("LAST-MODIFIED", icsDateTime(updated)));
  lines.push(
    prop("SEQUENCE", String(sequenceFrom(updated))),
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    prop("CATEGORIES", escapeText("AquaSlog")),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    prop("DESCRIPTION", escapeText(f.summary)),
    `TRIGGER;RELATED=START:${ALARM_TRIGGER}`,
    "END:VALARM",
    "END:VEVENT"
  );
  return lines;
}

// ── Calendars ───────────────────────────────────────────────────────────────

function calendarHeader({ name, timezone, refresh }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    prop("PRODID", PRODID),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (name) {
    lines.push(prop("X-WR-CALNAME", escapeText(name)), prop("NAME", escapeText(name)));
  }
  if (timezone) lines.push(prop("X-WR-TIMEZONE", escapeText(timezone)));
  if (refresh) {
    lines.push(
      prop("X-WR-CALDESC", escapeText("Maintenance reminders from AquaSlog. Each reminder appears on its next due date.")),
      `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`,
      `X-PUBLISHED-TTL:${REFRESH_INTERVAL}`
    );
  }
  return lines;
}

/**
 * Full subscription feed.
 * @param {{ reminders: object[], timezone?: string, today: string, origin: string, now?: Date,
 *           lastDone?: (r) => string|null }} p
 *   reminders: active reminders with tank_name; non-active rows are skipped defensively.
 */
export function buildReminderFeed({ reminders = [], timezone = "UTC", today, origin, now = new Date(), lastDone = () => null }) {
  const lines = calendarHeader({ name: CALENDAR_NAME, timezone, refresh: true });
  const sorted = reminders
    .filter((r) => r.status === "active" && DATE_RE.test(r.due_date ?? ""))
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.id - b.id));
  for (const r of sorted) {
    lines.push(...reminderVEvent(r, { today, origin, now, lastDone: lastDone(r) }));
  }
  lines.push("END:VCALENDAR");
  return serialize(lines);
}

/** One-event calendar for downloading ("Add to calendar"). */
export function buildReminderIcs(r, { today, origin, now = new Date(), lastDone = null, timezone } = {}) {
  const lines = calendarHeader({ name: null, timezone, refresh: false });
  lines.push(...reminderVEvent(r, { today, origin, now, lastDone, uid: `reminder-${r.id}-${icsDate(r.due_date)}@${UID_DOMAIN}` }));
  lines.push("END:VCALENDAR");
  return serialize(lines);
}

/** "Water change · Shrimp Cube 10g" → "water-change-shrimp-cube-10g.ics" */
export function icsFilename(r) {
  const base = `${reminderTitle(r)} ${r.tank_name || ""}`
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || `reminder-${r.id}`}.ics`;
}
