import { cache } from "react";
import { getDB } from "./db";

function parseData(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

/** "YYYY-MM-DD" (or "YYYY-MM-DD HH:MM:SS") → Date at UTC noon, or null. */
function toDate(str) {
  if (!str) return null;
  const d = new Date(`${String(str).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Apr 2026" */
export function fmtMonthYear(date) {
  return date ? `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}` : "";
}

/** "Oct 7, 2026" */
export function fmtShortDate(date) {
  return date ? `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}` : "";
}

/**
 * Public stats used by the page metadata and the Open Graph image.
 * Pure function of the rows so it is cheap to call more than once.
 */
export function publicTankStats(tank, entries, inhabitants) {
  const entryDates = entries.map((e) => toDate(e.date)).filter(Boolean);
  const created = toDate(tank.created_at);
  const candidates = [...entryDates, created].filter(Boolean);
  const startedAt = candidates.length ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : null;
  const today = toDate(new Date().toISOString());
  const daysRunning = startedAt ? Math.max(0, Math.round((today - startedAt) / 86_400_000)) : 0;

  // Entries are newest-first, so the first match is the latest water change.
  const lastWc = entries.find((e) => e.type === "parameters" && e.data?.waterChange);

  return {
    speciesCount: inhabitants.length,
    entryCount: entries.length,
    startedAt,
    daysRunning,
    lastWaterChange: lastWc ? toDate(lastWc.date) : null,
  };
}

/** "75-gallon planted tank · 14 species · 82 journal entries since Apr 2026" */
export function publicTankSummary(tank, stats) {
  const parts = [];
  if (tank.description) parts.push(tank.description.trim().replace(/[.\s]+$/, ""));
  parts.push(`${stats.speciesCount} species`);
  let entriesPart = `${stats.entryCount} journal ${stats.entryCount === 1 ? "entry" : "entries"}`;
  if (stats.entryCount > 0 && stats.startedAt) entriesPart += ` since ${fmtMonthYear(stats.startedAt)}`;
  parts.push(entriesPart);
  return parts.join(" · ");
}

/**
 * Loads a public tank (is_public = 1, matching slug) with its entries and inhabitants.
 * Returns null when the tank doesn't exist or isn't public.
 * Wrapped in React `cache` so generateMetadata and the page share one set of queries per request.
 */
export const getPublicTank = cache(async (username, slug) => {
  if (!username || !slug) return null;
  const db = getDB();

  const tank = await db
    .prepare(
      `SELECT t.id, t.user_id, t.name, t.description, t.slug, t.is_public, t.created_at, t.updated_at,
              u.username, u.display_name AS user_display_name
       FROM tanks t
       JOIN users u ON u.id = t.user_id
       WHERE u.username = ? AND t.slug = ? AND t.is_public = 1
       LIMIT 1`
    )
    .bind(String(username).toLowerCase(), String(slug).toLowerCase())
    .first();

  if (!tank) return null;

  // Same queries/order as GET /api/tanks/:id/entries and /inhabitants, so the
  // server-rendered journal matches what the client would have fetched.
  const [{ results: entryRows }, { results: inhabitants }] = await Promise.all([
    db.prepare(`SELECT * FROM entries WHERE tank_id = ? ORDER BY date DESC, time DESC, created_at DESC`).bind(tank.id).all(),
    db.prepare(`SELECT * FROM inhabitants WHERE tank_id = ? ORDER BY created_at ASC`).bind(tank.id).all(),
  ]);

  const entries = entryRows.map((row) => ({ ...row, data: parseData(row.data) }));
  const stats = publicTankStats(tank, entries, inhabitants);

  return {
    tank: { ...tank, ownerName: tank.user_display_name || tank.username },
    entries,
    inhabitants,
    stats,
  };
});
