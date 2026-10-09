/**
 * Which journal entries count as "doing" a reminder's task.
 *
 * Pure (no DB, no imports) so the same rules drive:
 *   - auto-reset in the entries POST/PATCH routes (lib/reminders/service.js),
 *   - "Last water change: N days ago" in the browser (from loaded entries),
 *   - the SQL used for the dashboard / email digest (LAST_DONE_SQL below).
 * Keep the JS predicates and the SQL conditions in sync.
 */

export const TASK_TYPES = {
  water_change: { label: "Water change",  defaultInterval: 7,  lastLabel: "Last water change", entryHint: "a water change",  journalable: true },
  filter_clean: { label: "Filter clean",  defaultInterval: 28, lastLabel: "Last filter clean", entryHint: "a filter clean",  journalable: true },
  fertilizer:   { label: "Fertilizer",    defaultInterval: 7,  lastLabel: "Last fertilized",   entryHint: "fertilizing",     journalable: true },
  test_water:   { label: "Test water",    defaultInterval: 7,  lastLabel: "Last water test",   entryHint: "test results",    journalable: false },
  custom:       { label: "Custom",        defaultInterval: 7,  lastLabel: null,                entryHint: null,              journalable: false },
};
export const TASK_TYPE_KEYS = Object.keys(TASK_TYPES);
export const AUTO_TASK_TYPES = ["water_change", "filter_clean", "fertilizer", "test_water"];

export const TEST_PARAM_KEYS = ["ph", "ammonia", "nitrite", "nitrate", "gh", "kh"];

/** Display name for a reminder row ({ task_type, title }). */
export function reminderTitle(r) {
  if (r?.title && String(r.title).trim()) return String(r.title).trim();
  return TASK_TYPES[r?.task_type]?.label ?? "Reminder";
}

function truthy(v) {
  if (v === true || v === 1) return true;
  if (typeof v === "string") return v !== "" && v !== "0" && v.toLowerCase() !== "false";
  return !!v;
}

function nonEmpty(v) {
  return v != null && String(v).trim() !== "";
}

/**
 * Task types satisfied by a journal entry ({ type, data }).
 * @returns {string[]} subset of AUTO_TASK_TYPES
 */
export function taskTypesForEntry(entry) {
  if (!entry) return [];
  let d = entry.data ?? {};
  if (typeof d === "string") {
    try { d = JSON.parse(d); } catch { d = {}; }
  }
  const out = [];
  if (entry.type === "parameters") {
    if (truthy(d.waterChange)) out.push("water_change");
    if (truthy(d.filterCleaned)) out.push("filter_clean");
    if (TEST_PARAM_KEYS.some((k) => nonEmpty(d[k]))) out.push("test_water");
  } else if (entry.type === "changes") {
    if (d.changeType === "Fertilized") out.push("fertilizer");
  }
  return out;
}

/** Latest entry date per task type from a list of entries. → { water_change: "2026-08-28", … } */
export function lastDoneFromEntries(entries) {
  const last = {};
  for (const e of entries || []) {
    if (!e?.date) continue;
    for (const t of taskTypesForEntry(e)) {
      if (!last[t] || e.date > last[t]) last[t] = e.date;
    }
  }
  return last;
}

// SQL boolean conditions over `entries` (alias-free), mirroring taskTypesForEntry.
const SQL_TRUTHY = (path) =>
  `(json_extract(data, '${path}') IS NOT NULL AND json_extract(data, '${path}') NOT IN (0, '', '0', 'false'))`;
const SQL_NONEMPTY = (path) => `TRIM(COALESCE(json_extract(data, '${path}'), '')) != ''`;

export const ENTRY_MATCH_SQL = {
  water_change: `type = 'parameters' AND ${SQL_TRUTHY("$.waterChange")}`,
  filter_clean: `type = 'parameters' AND ${SQL_TRUTHY("$.filterCleaned")}`,
  fertilizer:   `type = 'changes' AND json_extract(data, '$.changeType') = 'Fertilized'`,
  test_water:   `type = 'parameters' AND (${TEST_PARAM_KEYS.map((k) => SQL_NONEMPTY(`$.${k}`)).join(" OR ")})`,
};

/**
 * One query returning (tank_id, task_type, last_date) rows for the tanks in `tankIdsSql`
 * (a SQL fragment or `?` list). Bind the tank ids once per task type, in AUTO_TASK_TYPES order.
 */
export function lastDoneSql(placeholders) {
  return AUTO_TASK_TYPES.map(
    (t) => `SELECT tank_id, '${t}' AS task_type, MAX(date) AS last_date FROM entries
            WHERE tank_id IN (${placeholders}) AND ${ENTRY_MATCH_SQL[t]} GROUP BY tank_id`
  ).join("\nUNION ALL\n");
}
