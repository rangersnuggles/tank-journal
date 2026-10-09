/**
 * Species catalog search (migrations/0004_species.sql, data from Wikidata, CC0).
 *
 * The catalog is small (~3.3k rows) and read-only, so each isolate loads it once
 * and ranks in memory: one D1 read per cold start instead of a table scan per
 * keystroke (word-prefix and alias matches can't use an index anyway).
 */

const KINDS = ["fish", "invert", "plant"];
let catalogPromise = null;

function loadCatalog(db) {
  if (!catalogPromise) {
    catalogPromise = db
      .prepare(`SELECT id, qid, kind, common_name, scientific_name, aliases, popularity FROM species`)
      .all()
      .then(({ results }) =>
        results.map((r) => {
          let aliases = [];
          try { aliases = JSON.parse(r.aliases || "[]"); } catch {}
          return {
            ...r,
            aliases,
            _common: r.common_name.toLowerCase(),
            _sci: r.scientific_name.toLowerCase(),
            _aliases: aliases.map((a) => a.toLowerCase()),
          };
        })
      )
      .catch((err) => {
        catalogPromise = null; // retry on the next request
        throw err;
      });
  }
  return catalogPromise;
}

export function normalizeQuery(q) {
  return String(q ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
}

// True when some word of `text` (split on space, hyphen, apostrophe, parens) starts with q.
function wordPrefix(text, q) {
  let i = text.indexOf(q);
  while (i !== -1) {
    if (i === 0 || /[\s\-'(‘’"]/.test(text[i - 1])) return true;
    i = text.indexOf(q, i + 1);
  }
  return false;
}

/**
 * Rank: an exact name/alias hit first ("betta" → Betta splendens, alias "Betta"),
 * then 0 common-name prefix > 1 common-name word-prefix > 2 scientific name
 * (prefix or epithet) > 3 alias (prefix or word-prefix). Ties: popularity
 * (sitelinks, boosted for hand-curated hobby species), then shorter name.
 */
export async function searchSpecies(db, rawQ, { kinds = null, limit = 10 } = {}) {
  const q = normalizeQuery(rawQ);
  if (!q) return [];
  const catalog = await loadCatalog(db);
  const out = [];
  for (const s of catalog) {
    if (kinds && !kinds.includes(s.kind)) continue;
    let rank = null;
    let alias = null;
    if (s._common === q || s._sci === q) rank = -0.5;
    else if (s._aliases.includes(q)) { rank = -0.5; alias = s.aliases[s._aliases.indexOf(q)]; }
    else if (s._common.startsWith(q)) rank = 0;
    else if (wordPrefix(s._common, q)) rank = 1;
    else if (s._sci.startsWith(q) || wordPrefix(s._sci, q)) rank = 2;
    else {
      const i = s._aliases.findIndex((a) => a.startsWith(q) || wordPrefix(a, q));
      if (i !== -1) { rank = 3; alias = s.aliases[i]; }
    }
    if (rank !== null) out.push({ s, rank, alias });
  }
  out.sort((a, b) =>
    a.rank - b.rank ||
    b.s.popularity - a.s.popularity ||
    a.s.common_name.length - b.s.common_name.length ||
    a.s.common_name.localeCompare(b.s.common_name)
  );
  return out.slice(0, limit).map(({ s, alias }) => ({
    id: s.id,
    qid: s.qid,
    kind: s.kind,
    common_name: s.common_name,
    scientific_name: s.scientific_name,
    ...(alias ? { matched_alias: alias } : {}),
  }));
}

export function parseKinds(raw) {
  if (!raw) return null;
  const kinds = String(raw).split(",").map((k) => k.trim().toLowerCase()).filter((k) => KINDS.includes(k));
  return kinds.length ? kinds : null;
}

/** Validates an optional species id from a request body. Returns { value } or { error }. */
export async function validateSpeciesId(db, raw) {
  if (raw === undefined) return { value: undefined };
  if (raw === null || raw === "") return { value: null };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { error: "species_id must be a positive integer or null" };
  const row = await db.prepare(`SELECT id FROM species WHERE id = ?`).bind(id).first();
  if (!row) return { error: "Unknown species_id" };
  return { value: id };
}

/** Inhabitant rows joined with their (optional) species, as returned by the inhabitants API. */
export const INHABITANT_SELECT = `
  SELECT i.*, s.common_name AS species_common_name, s.scientific_name AS species_scientific_name,
         s.kind AS species_kind, s.qid AS species_qid
  FROM inhabitants i LEFT JOIN species s ON s.id = i.species_id`;
