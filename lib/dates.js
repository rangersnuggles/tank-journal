/**
 * Local-time date helpers.
 *
 * `new Date().toISOString()` is UTC, so in the evening (west of UTC) it already
 * reports tomorrow's date. Journal dates are the user's wall-clock date, so use
 * these instead. Call them when a form opens, not at module load, so a tab left
 * open overnight still defaults to the right day.
 *
 * On the server (Workers run in UTC) these return the server's local time, which
 * is only a fallback — clients should send their own local date.
 */

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" in the runtime's local timezone. */
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "HH:MM" (24h) in the runtime's local timezone. */
export function localTimeStr(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** True for a well-formed "YYYY-MM-DD" string. */
export function isDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
