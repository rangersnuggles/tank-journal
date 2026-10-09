/**
 * Water-parameter helpers shared by the Trends charts and the "Latest parameters" card.
 *
 * Parameter entries store free-text strings (entries.data.temp, .ph, …) exactly as the
 * user typed them: "0.25", "<5", "~7", "7.0-7.2", "15 ppm", "". `parseParam` turns those
 * into something plottable without ever throwing; anything it can't read comes back
 * with `value: null` and the original text in `raw`.
 */

const NUM = String.raw`[+]?(?:\d+(?:\.\d*)?|\.\d+)`;
const RANGE_RE = new RegExp(String.raw`^(${NUM})\s*(?:-|–|—|to|\.\.)\s*(${NUM})$`, "i");
const SINGLE_RE = new RegExp(String.raw`^(${NUM})$`);
// Units / suffixes people tack on. Stripped before parsing; never used for conversion.
const UNIT_RE = /\s*(?:ppm|mg\s*\/\s*l|°\s*[fc]|deg(?:rees)?\s*[fc]?|°?\s*d\s*[gk]?\s*h|dkh|dgh|f)\s*$/i;

/**
 * Lenient parser for a single parameter reading.
 *
 * @param {unknown} input  the stored string (numbers are accepted too)
 * @returns {{ value: number|null, qualifier: '<'|'>'|'~'|null, raw: string,
 *             isRange: boolean, range: [number, number]|null }}
 *   - `value`: the number to plot (a range's midpoint), or null if unreadable/blank
 *   - `qualifier`: '<' / '>' for "below/above what the test kit reads" ("<5", "≤5",
 *     ">80", "80+"), '~' for approximate ("~7", "≈7", "approx 7", "ca. 7"), else null
 *   - `isRange` / `range`: set for "7.0-7.2", "7 to 7.2" (value is the midpoint)
 */
export function parseParam(input) {
  const raw = input == null ? "" : String(input).trim();
  const empty = { value: null, qualifier: null, raw, isRange: false, range: null };
  if (!raw) return empty;

  let s = raw.toLowerCase();
  let qualifier = null;

  // Leading qualifiers.
  const q = s.match(/^(<=|>=|=<|=>|<|>|≤|≥|~|≈|approx\.?|about|around|ca\.?|c\.)\s*/);
  if (q) {
    const sym = q[1];
    qualifier = /^(<|≤|=<)/.test(sym) ? "<" : /^(>|≥|=>)/.test(sym) ? ">" : "~";
    s = s.slice(q[0].length);
  }

  // Units, then a trailing "+" ("80+" = at least 80) or "?" ("7?" = unsure).
  s = s.replace(UNIT_RE, "").trim();
  if (/\+$/.test(s)) { s = s.slice(0, -1).trim(); qualifier = qualifier ?? ">"; }
  if (/\?$/.test(s)) { s = s.slice(0, -1).trim(); qualifier = qualifier ?? "~"; }
  s = s.replace(UNIT_RE, "").trim();

  // A lone decimal comma ("7,2") is a decimal point.
  if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
  s = s.replace(/(\d),(\d)/g, "$1.$2");

  const range = s.match(RANGE_RE);
  if (range) {
    let lo = Number(range[1]);
    let hi = Number(range[2]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return empty;
    if (lo > hi) [lo, hi] = [hi, lo];
    const value = lo === hi ? lo : round((lo + hi) / 2);
    return { value, qualifier, raw, isRange: lo !== hi, range: lo === hi ? null : [lo, hi] };
  }

  if (SINGLE_RE.test(s)) {
    const value = Number(s);
    if (!Number.isFinite(value)) return empty;
    return { value, qualifier, raw, isRange: false, range: null };
  }

  return empty;
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

/** True when a parsed reading is not an exact number (drawn hollow in charts). */
export function isInexact(parsed) {
  return !!parsed && (parsed.qualifier != null || parsed.isRange);
}

/**
 * Typical freshwater ranges — GENERAL GUIDANCE ONLY, not targets. Species, planted vs.
 * fish-only, shrimp, and soft/hard-water setups all differ; these just give the charts a
 * frame of reference. Edit freely. `min`/`max` may be null for an open-ended side.
 */
export const TYPICAL_RANGES = {
  temp:    { min: 72,  max: 82,  note: "Most tropical community fish" },
  ph:      { min: 6.0, max: 8.0, note: "Stability matters more than the exact number" },
  ammonia: { min: 0,   max: 0,   note: "Should read 0 in a cycled tank" },
  nitrite: { min: 0,   max: 0,   note: "Should read 0 in a cycled tank" },
  nitrate: { min: 0,   max: 40,  note: "Under 40 for community tanks; planted tanks often run 10–30" },
  gh:      { min: 4,   max: 12,  note: "Soft-water and shrimp species vary" },
  kh:      { min: 3,   max: 8,   note: "CO₂-injected and soft-water tanks often run lower" },
};

/**
 * Per-parameter metadata, in display order. `label`/`unit` match the journal's badges.
 * `minSpan` keeps a near-flat series from being blown up into noise; `zeroBased` pins the
 * y-axis to 0 for concentrations.
 */
export const PARAM_META = [
  { key: "temp",    label: "Temp", name: "Temperature", unit: "°F",  decimals: 1, minSpan: 4,   zeroBased: false },
  { key: "ph",      label: "pH",   name: "pH",          unit: "",    decimals: 1, minSpan: 0.6, zeroBased: false, rangeDecimals: 1 },
  { key: "ammonia", label: "NH₃",  name: "Ammonia",     unit: "ppm", decimals: 2, minSpan: 0.5, zeroBased: true },
  { key: "nitrite", label: "NO₂",  name: "Nitrite",     unit: "ppm", decimals: 2, minSpan: 0.5, zeroBased: true },
  { key: "nitrate", label: "NO₃",  name: "Nitrate",     unit: "ppm", decimals: 0, minSpan: 10,  zeroBased: true },
  { key: "gh",      label: "GH",   name: "GH",          unit: "°dH", decimals: 0, minSpan: 4,   zeroBased: false },
  { key: "kh",      label: "KH",   name: "KH",          unit: "°dH", decimals: 0, minSpan: 4,   zeroBased: false },
].map((m) => ({ ...m, typical: TYPICAL_RANGES[m.key] }));

export const PARAM_KEYS = PARAM_META.map((m) => m.key);

/** "6.0–8.0", "< 40", "0" — for captions. */
export function formatTypical(meta) {
  const t = meta?.typical;
  if (!t) return "";
  const u = meta.unit ? ` ${meta.unit}` : "";
  const f = (n) => n.toFixed(meta.rangeDecimals ?? 0);
  if (t.min != null && t.max != null) {
    if (t.min === t.max) return `${f(t.min)}${u}`;
    if (t.min === 0 && meta.zeroBased) return `under ${f(t.max)}${u}`;
    return `${f(t.min)}–${f(t.max)}${u}`;
  }
  if (t.max != null) return `under ${f(t.max)}${u}`;
  if (t.min != null) return `over ${f(t.min)}${u}`;
  return "";
}

/**
 * Where a parsed reading sits relative to the typical range: "low" | "high" | null.
 * Qualified readings only count when they're unambiguous ("<5" is never "high";
 * ">80" with max 82 can't be called high).
 */
export function rangeStatus(key, parsed) {
  const t = TYPICAL_RANGES[key];
  if (!t || !parsed || parsed.value == null) return null;
  const v = parsed.value;
  const q = parsed.qualifier;
  if (t.max != null && v > t.max && q !== "<") return "high";
  if (t.min != null && v < t.min && q !== ">") return "low";
  // "<0.25" ammonia is fine; "<5" nitrate is fine. ">40" nitrate with max 40 is high.
  if (t.max != null && q === ">" && v >= t.max) return "high";
  if (t.min != null && q === "<" && v <= t.min && t.min > 0) return "low";
  return null;
}

/** Timestamp (ms, local time) for an entry's date + time; time defaults to noon. */
export function entryTimestamp(entry) {
  if (!entry?.date) return NaN;
  const time = /^\d{2}:\d{2}/.test(entry.time || "") ? entry.time.slice(0, 5) : "12:00";
  return new Date(`${entry.date}T${time}:00`).getTime();
}

/**
 * Readings for one parameter from a list of journal entries, oldest first.
 * Unparseable values are skipped (they still show in the journal as typed).
 */
export function readingsFor(entries, key) {
  const out = [];
  for (const e of entries || []) {
    if (e.type !== "parameters") continue;
    const raw = e.data?.[key];
    if (raw == null || String(raw).trim() === "") continue;
    const parsed = parseParam(raw);
    if (parsed.value == null) continue;
    out.push({ entry: e, t: entryTimestamp(e), ...parsed });
  }
  return out.sort((a, b) => a.t - b.t || (a.entry.id ?? 0) - (b.entry.id ?? 0));
}

/** Format a number for display with at most `decimals` places, trimming trailing zeros. */
export function fmtNum(n, decimals = 2) {
  if (n == null || !Number.isFinite(n)) return "";
  return String(Number(n.toFixed(Math.max(decimals, 2))));
}
