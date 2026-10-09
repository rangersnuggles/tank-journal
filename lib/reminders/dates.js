/**
 * Pure calendar-date helpers for reminders. All dates are "YYYY-MM-DD" strings
 * representing a wall-clock day; arithmetic is done in UTC so DST never shifts a
 * day. No imports — safe for Pages (edge), the reminders Worker, and the browser.
 */

const DAY_MS = 86_400_000;

function toUTC(str) {
  const [y, m, d] = str.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** "2026-10-09" + 42 → "2026-11-20" */
export function addDays(dateStr, n) {
  return fromUTC(toUTC(dateStr) + Math.round(n) * DAY_MS);
}

/** Whole days from b to a (a - b). diffDays("2026-10-12", "2026-10-09") === 3 */
export function diffDays(a, b) {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}

export function maxDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** True if `tz` is a timezone this runtime's Intl understands. */
export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The wall-clock date/hour/time for instant `now` in timezone `tz` (falls back to UTC).
 * @returns {{ date: string, hour: number, time: string, timeZone: string }}
 */
export function zonedParts(now, tz) {
  const timeZone = isValidTimeZone(tz) ? tz : "UTC";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const hour = Number(parts.hour) % 24;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    time: `${String(hour).padStart(2, "0")}:${parts.minute}`,
    timeZone,
  };
}

/** "Aug 28" (adds the year when it differs from `today`'s year). */
export function fmtShortDate(dateStr, today) {
  if (!dateStr) return "";
  const d = new Date(toUTC(dateStr));
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  if (today && today.slice(0, 4) !== dateStr.slice(0, 4)) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

/** 0 → "today", 1 → "yesterday", 5 → "5 days ago", 41 → "6 weeks ago", 95 → "3 months ago" */
export function fmtAgo(days) {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} months ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * Due-state for a reminder relative to `today`.
 * @returns {{ kind: "overdue"|"today"|"soon"|"later", days: number, label: string }}
 *   days = due - today (negative when overdue)
 */
export function dueState(dueDate, today) {
  const days = diffDays(dueDate, today);
  if (days < 0) {
    const n = -days;
    return { kind: "overdue", days, label: `${n} day${n === 1 ? "" : "s"} overdue` };
  }
  if (days === 0) return { kind: "today", days, label: "Due today" };
  if (days === 1) return { kind: "soon", days, label: "Due tomorrow" };
  return { kind: days <= 7 ? "soon" : "later", days, label: `In ${days} days` };
}

/** 42 → "6 weeks", 7 → "week", 3 → "3 days", 1 → "day" — for "Every …" labels. */
export function fmtInterval(intervalDays) {
  if (!intervalDays) return "";
  if (intervalDays % 7 === 0) {
    const w = intervalDays / 7;
    return w === 1 ? "week" : `${w} weeks`;
  }
  return intervalDays === 1 ? "day" : `${intervalDays} days`;
}
