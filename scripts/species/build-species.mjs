#!/usr/bin/env node
/**
 * AquaSlog — species catalog builder (Wikidata → migrations/0004_species.sql)
 *
 *   node scripts/species/build-species.mjs            # fetch (cached) + write the migration
 *   node scripts/species/build-species.mjs --refresh  # ignore the local query cache
 *   node scripts/species/build-species.mjs --stats    # also print per-group counts
 *
 * Data source: Wikidata only (https://www.wikidata.org), which is CC0. We read
 * taxon names (P225), English labels/aliases, English common names (P1843), the
 * English Wikipedia sitelink *title* (part of the Wikidata item, also CC0), and
 * the sitelink count (used only as a popularity hint for ranking). No FishBase
 * (CC BY-NC) or Wikipedia article/table content is used. scripts/species/aliases.json
 * holds a small hand-written list of extra hobby names (original data).
 *
 * Approach: for each "root" taxon below (a family, genus or single species, resolved by its
 * scientific name inside Animalia/Plantae so homonyms like the moth genus
 * Riccia are skipped) we query every descendant (wdt:P171+) of rank species,
 * subspecies or variety that is an actual taxon (P31 Q16521, not a synonym).
 * Fish additionally need a FishBase ID (P938) — a cheap "real, catalogued fish"
 * signal — and at least one English common name, since thousands of obscure
 * species would otherwise drown out the aquarium ones. Invertebrates and plants
 * are kept when they have an English common name or an English Wikipedia
 * article (a "reasonably well known" signal), since hobbyists often use
 * scientific names for those ("Cryptocoryne wendtii", "Rotala rotundifolia").
 *
 * The output is deterministic (sorted by kind, scientific name) so re-running
 * against an unchanged Wikidata produces an identical file.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = resolve(ROOT, "migrations/0004_species.sql");
const CACHE_DIR = resolve(ROOT, "node_modules/.cache/aquaslog-species");
const ALIASES = JSON.parse(readFileSync(resolve(HERE, "aliases.json"), "utf8"));

const ENDPOINT = "https://query.wikidata.org/sparql";
// Identify the tool per the Wikimedia User-Agent policy. No personal contact info.
const USER_AGENT = "AquaSlog-species-builder/1.1 (https://github.com/rangersnuggles/tank-journal)";

const REFRESH = process.argv.includes("--refresh");
const STATS = process.argv.includes("--stats");

const ANIMALIA = "Q729";
const PLANTAE = "Q756";

// Root taxa, by scientific name. kingdom disambiguates homonyms.
const GROUPS = [
  {
    kind: "fish", kingdom: ANIMALIA, requireFishBase: true, requireCommonName: true,
    taxa: [
      // characins
      "Characidae", "Alestidae", "Lebiasinidae", "Gasteropelecidae", "Serrasalmidae",
      "Anostomidae", "Chilodontidae", "Crenuchidae", "Hemiodontidae", "Acestrorhynchidae",
      // cichlids, cyprinids & relatives
      "Cichlidae", "Cyprinidae", "Danionidae", "Xenocyprididae", "Leuciscidae",
      // livebearers & killifish
      "Poeciliidae", "Goodeidae", "Anablepidae", "Aplocheilidae", "Nothobranchiidae",
      "Rivulidae", "Fundulidae", "Procatopodidae", "Cyprinodontidae", "Adrianichthyidae",
      // catfish
      "Callichthyidae", "Loricariidae", "Mochokidae", "Doradidae", "Auchenipteridae",
      "Pimelodidae", "Heptapteridae", "Pangasiidae", "Siluridae", "Bagridae", "Aspredinidae",
      // labyrinth fish & others
      "Osphronemidae", "Helostomatidae", "Anabantidae", "Channidae", "Badidae", "Nandidae",
      // loaches
      "Cobitidae", "Botiidae", "Nemacheilidae", "Balitoridae", "Gastromyzontidae",
      // rainbowfish & blue-eyes
      "Melanotaeniidae", "Pseudomugilidae", "Telmatherinidae", "Bedotiidae",
      // misc. freshwater oddballs
      "Polypteridae", "Mastacembelidae", "Apteronotidae", "Gymnotidae", "Notopteridae",
      "Osteoglossidae", "Zenarchopteridae", "Toxotidae", "Mormyridae", "Gyrinocheilidae",
      // freshwater gobies & sleepers (genera — Gobiidae itself is mostly marine)
      "Brachygobius", "Stiphodon", "Rhinogobius", "Sicyopterus", "Mugilogobius",
      "Tateurndina", "Mogurnda", "Hypseleotris", "Dormitator",
      // freshwater puffers (genera)
      "Carinotetraodon", "Dichotomyctere", "Auriglobus", "Pao",
    ],
  },
  {
    kind: "invert", kingdom: ANIMALIA,
    taxa: [
      "Neocaridina", "Caridina", "Macrobrachium", "Atyopsis", "Atya",
      "Neritidae", "Planorbidae", "Ampullariidae", "Thiaridae", "Pachychilidae", "Viviparidae",
      "Clea", "Procambarus", "Cambarellus", "Cherax", "Faxonius",
      "Geosesarma", "Corbicula", "Physella acuta", "Palaemonetes paludosus",
    ],
  },
  {
    kind: "plant", kingdom: PLANTAE,
    taxa: [
      "Anubias", "Cryptocoryne", "Echinodorus", "Helanthium", "Bucephalandra", "Microsorum",
      "Leptochilus", "Bolbitis", "Vallisneria", "Sagittaria", "Hygrophila", "Ludwigia",
      "Rotala", "Hemianthus", "Micranthemum", "Glossostigma", "Eleocharis", "Marsilea",
      "Monosolenium", "Taxiphyllum", "Vesicularia", "Riccia",
      "Salvinia", "Limnobium", "Pistia", "Ceratophyllum", "Egeria", "Elodea", "Myriophyllum",
      "Bacopa", "Alternanthera", "Staurogyne", "Pogostemon", "Lilaeopsis", "Aponogeton",
      "Nymphaea", "Nymphoides", "Hydrocotyle", "Lemna", "Spirodela", "Wolffia",
      "Limnophila", "Cabomba", "Ammannia", "Proserpinaca", "Najas",
      "Hydrilla", "Lagenandra", "Didiplis", "Blyxa", "Nesaea", "Heteranthera",
      "Potamogeton", "Barclaya",
      // single species from large, mostly terrestrial genera
      "Phyllanthus fluitans", "Ranunculus inundatus", "Lobelia cardinalis", "Juncus repens",
      "Crinum calamistratum", "Crinum thaianum", "Pontederia crassipes",
      "Utricularia graminifolia", "Utricularia gibba", "Fissidens fontanus",
      "Riccardia chamedryfolia",
    ],
  },
];

// ── SPARQL helpers ──────────────────────────────────────────────────────────

mkdirSync(CACHE_DIR, { recursive: true });

async function sparql(query, label) {
  const key = createHash("sha1").update(query).digest("hex").slice(0, 16);
  const file = resolve(CACHE_DIR, `${key}.json`);
  if (!REFRESH && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query }),
    });
    if (res.ok) {
      const rows = (await res.json()).results.bindings.map((b) =>
        Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value]))
      );
      writeFileSync(file, JSON.stringify(rows));
      return rows;
    }
    const retryAfter = Number(res.headers.get("retry-after")) || 0;
    if (attempt >= 4) throw new Error(`SPARQL ${label}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    const wait = Math.max(retryAfter * 1000, 5000 * attempt);
    console.warn(`  ${label}: HTTP ${res.status}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

const qid = (uri) => uri.replace("http://www.wikidata.org/entity/", "");
const lit = (s) => JSON.stringify(s); // SPARQL string literal (JSON escaping is compatible)

/** Resolve scientific names to QIDs within a kingdom. Returns Map(name → [qid]). */
async function resolveTaxa(names, kingdom) {
  const map = new Map();
  // Small batches + forward gearing keep the P171+ walk bottom-up (top-down from
  // Animalia would time out).
  for (let i = 0; i < names.length; i += 15) {
    const batch = names.slice(i, i + 15);
    const rows = await sparql(`
      SELECT DISTINCT ?name ?t WHERE {
        VALUES ?name { ${batch.map(lit).join(" ")} }
        ?t wdt:P225 ?name .
        ?t wdt:P171+ ?k .
        hint:Prior hint:gearing "forward" .
        VALUES ?k { wd:${kingdom} }
      }`, `resolve ${kingdom} #${i / 15}`);
    for (const r of rows) {
      if (!map.has(r.name)) map.set(r.name, []);
      map.get(r.name).push(qid(r.t));
    }
  }
  return map;
}

const SEP = "\u001f";
function descendantsQuery(rootQid) {
  return `
    SELECT ?item (SAMPLE(?sci) AS ?sci) (SAMPLE(?rank) AS ?rank) (SAMPLE(?lab) AS ?lab)
           (SAMPLE(?title) AS ?title) (SAMPLE(?sl) AS ?sl) (SAMPLE(?fb) AS ?fb)
           (GROUP_CONCAT(DISTINCT ?cn; separator="${SEP}") AS ?cns)
           (GROUP_CONCAT(DISTINCT ?al; separator="${SEP}") AS ?als)
    WHERE {
      VALUES ?rank { wd:Q7432 wd:Q68947 wd:Q767728 }   # species, subspecies, variety
      ?item wdt:P171* wd:${rootQid} ; wdt:P105 ?rank ; wdt:P31 wd:Q16521 ; wdt:P225 ?sci .
      OPTIONAL { ?item wdt:P938 ?fb }
      OPTIONAL { ?item rdfs:label ?lab FILTER(LANG(?lab) = "en") }
      OPTIONAL { ?item wdt:P1843 ?cn FILTER(LANG(?cn) IN ("en", "en-us", "en-gb", "en-ca", "en-au")) }
      OPTIONAL { ?item skos:altLabel ?al FILTER(LANG(?al) = "en") }
      OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title }
      OPTIONAL { ?item wikibase:sitelinks ?sl }
    }
    GROUP BY ?item`;
}

// ── Name cleanup ────────────────────────────────────────────────────────────

const RANK = { Q7432: "species", Q68947: "subspecies", Q767728: "variety" };
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
// Looks like a scientific name (binomial/trinomial, optionally with var./subsp.).
const looksScientific = (s) =>
  /^[A-Z][a-z]+( \([A-Z][a-z]+\))?( (var\.|subsp\.|ssp\.|f\.) )?( ?[a-z][a-z-]+){1,3}$/.test(s.trim()) ||
  /^[A-Z][a-z]+ [a-z]+ (var\.|subsp\.|ssp\.|f\.) [a-z-]+$/.test(s.trim());
const titleCore = (t) => t.replace(/\s*\([^)]*\)\s*$/, "").trim(); // "Platy (fish)" → "Platy"

function isUsableCommonName(s, sci) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 3 || t.length > 60) return false;
  if (norm(t) === norm(sci)) return false;
  if (looksScientific(t)) return false;
  if (/[0-9_:;/\\]|^Q\d+$/.test(t)) return false;
  if (!/[a-z]/i.test(t)) return false; // all punctuation
  if (/\b(sp|spp|cf|aff)\.?$/i.test(t)) return false;
  return true;
}

// Sentence case for all-lowercase Wikidata labels; keep author casing otherwise.
function displayCase(s) {
  const t = s.trim().replace(/\s+/g, " ");
  if (t === t.toLowerCase()) return t[0].toUpperCase() + t.slice(1);
  return t;
}

/**
 * Pick the most common English name. Each source "votes" for its name(s); the
 * enwiki title (Wikipedia titles follow WP:COMMONNAME) breaks ties, then P1843,
 * then the label. Casing prefers the enwiki title, then P1843, then label.
 */
function chooseNames(r) {
  const sci = r.sci;
  const sources = [];
  const title = r.title ? titleCore(r.title) : null;
  if (title && isUsableCommonName(title, sci)) sources.push({ name: title, w: 3, prio: 0 });
  for (const cn of r.cns ? r.cns.split(SEP) : []) if (isUsableCommonName(cn, sci)) sources.push({ name: cn, w: 2, prio: 1 });
  if (r.lab && isUsableCommonName(r.lab, sci)) sources.push({ name: r.lab, w: 2, prio: 2 });
  for (const al of r.als ? r.als.split(SEP) : []) if (isUsableCommonName(al, sci)) sources.push({ name: al, w: 1, prio: 3 });

  const byKey = new Map();
  for (const s of sources) {
    const k = norm(s.name);
    const cur = byKey.get(k) ?? { key: k, score: 0, prio: 9, display: null, displayPrio: 9 };
    cur.score += s.w;
    cur.prio = Math.min(cur.prio, s.prio);
    if (s.prio < cur.displayPrio) { cur.display = s.name; cur.displayPrio = s.prio; }
    byKey.set(k, cur);
  }
  const ranked = [...byKey.values()].sort((a, b) => b.score - a.score || a.prio - b.prio || a.key.localeCompare(b.key));

  // Scientific synonyms (aliases / a differently-titled enwiki article) are useful search aliases.
  const sciAliases = [];
  for (const s of [...(r.als ? r.als.split(SEP) : []), title ?? ""]) {
    if (s && looksScientific(s) && norm(s) !== norm(sci)) sciAliases.push(s.trim());
  }
  return {
    common: ranked[0] ? displayCase(ranked[0].display) : null,
    otherCommon: ranked.slice(1).map((x) => displayCase(x.display)),
    sciAliases,
  };
}

// ── Build ───────────────────────────────────────────────────────────────────

const items = new Map(); // qid → record
const stats = [];

for (const group of GROUPS) {
  const taxa = [...new Set(group.taxa)];
  const resolved = await resolveTaxa(taxa, group.kingdom);
  for (const name of taxa) {
    const qids = resolved.get(name);
    if (!qids) { console.warn(`! ${group.kind}: could not resolve "${name}" in ${group.kingdom}`); continue; }
    let kept = 0, seen = 0;
    for (const root of qids) {
      const rows = await sparql(descendantsQuery(root), `${name} (${root})`);
      for (const r of rows) {
        seen++;
        const id = qid(r.item);
        if (items.has(id)) continue;
        const names = chooseNames(r);
        const sitelinks = Number(r.sl || 0);
        const override = ALIASES.overrides?.[r.sci];
        const picked = id === root || !!override; // a species listed by name, or one with hand-written names
        if (!picked) {
          if (group.requireFishBase && !r.fb) continue;
          const hasCommon = !!names.common;
          if (group.requireCommonName && !hasCommon) continue;
          if (!group.requireCommonName && !hasCommon && !r.title) continue;
        }
        items.set(id, { qid: id, kind: group.kind, sci: r.sci, rank: RANK[qid(r.rank)], sitelinks, ...names, override });
        kept++;
      }
    }
    stats.push({ kind: group.kind, taxon: name, seen, kept });
  }
}

// Extra hand-picked taxa (usually genera people log by genus, e.g. "Otocinclus").
const extras = ALIASES.extra ?? [];
if (extras.length) {
  for (const kingdom of [ANIMALIA, PLANTAE]) {
    const want = extras.filter((e) => (e.kind === "plant" ? PLANTAE : ANIMALIA) === kingdom);
    if (!want.length) continue;
    const resolved = await resolveTaxa(want.map((e) => e.scientific_name), kingdom);
    const allQids = [...new Set([...resolved.values()].flat())];
    const sl = new Map((await sparql(`
      SELECT ?t ?sl WHERE { VALUES ?t { ${allQids.map((q) => `wd:${q}`).join(" ")} } ?t wikibase:sitelinks ?sl }`,
      "extra sitelinks")).map((r) => [qid(r.t), Number(r.sl)]));
    for (const e of want) {
      const qids = resolved.get(e.scientific_name);
      if (!qids) { console.warn(`! extra: could not resolve "${e.scientific_name}"`); continue; }
      // Homonyms inside one kingdom are rare; take the best-known.
      const best = qids.sort((a, b) => (sl.get(b) ?? 0) - (sl.get(a) ?? 0))[0];
      items.set(best, {
        qid: best, kind: e.kind, sci: e.scientific_name, rank: "genus", sitelinks: sl.get(best) ?? 0,
        common: null, otherCommon: [], sciAliases: [], override: e,
      });
    }
  }
}

// Hand-curated entries (aliases.json) are hobby species by definition; boost them
// above obscure wild species that happen to share a prefix ("monte" → Monte Carlo).
const CURATED_BOOST = 100;

// Apply overrides, finalize names, dedupe.
const records = [];
for (const it of items.values()) {
  const o = it.override ?? {};
  let common = o.common_name ?? it.common;
  const aliasList = [
    ...(o.common_name && it.common && norm(it.common) !== norm(o.common_name) ? [it.common] : []),
    ...it.otherCommon,
    ...(o.aliases ?? []),
    ...it.sciAliases,
  ];
  if (!common) common = it.sci; // well-known plant/invert without an English name: show the scientific name
  const seenAlias = new Set([norm(common), norm(it.sci)]);
  const aliases = [];
  for (const a of aliasList) {
    const k = norm(a);
    if (!k || seenAlias.has(k)) continue;
    seenAlias.add(k);
    aliases.push(a.trim());
  }
  const popularity = it.sitelinks + (it.override ? CURATED_BOOST : 0);
  records.push({ qid: it.qid, kind: it.kind, common_name: common, scientific_name: it.sci, aliases, popularity });
}

// The same scientific name can exist as two items (duplicate/merged-in-progress entries); keep the better-known one.
const bySci = new Map();
for (const r of records) {
  const k = `${r.kind}|${norm(r.scientific_name)}`;
  const cur = bySci.get(k);
  if (!cur || r.popularity > cur.popularity || (r.popularity === cur.popularity && r.qid < cur.qid)) bySci.set(k, r);
}
// Synonym pairs: two items for the same organism (old and new genus, e.g. Microsorum /
// Leptochilus pteropus) that end up with the same common name and list each other's
// scientific name as an alias. Keep the better-known one and fold the other's aliases in.
const byCommon = new Map();
for (const r of bySci.values()) {
  const k = `${r.kind}|${norm(r.common_name)}`;
  if (!byCommon.has(k)) byCommon.set(k, []);
  byCommon.get(k).push(r);
}
for (const group of byCommon.values()) {
  if (group.length < 2) continue;
  group.sort((a, b) => b.popularity - a.popularity || a.qid.localeCompare(b.qid));
  const keep = group[0];
  for (const other of group.slice(1)) {
    const linked = keep.aliases.some((a) => norm(a) === norm(other.scientific_name)) ||
                   other.aliases.some((a) => norm(a) === norm(keep.scientific_name));
    if (!linked) continue;
    for (const a of [other.scientific_name, ...other.aliases]) {
      if (norm(a) !== norm(keep.scientific_name) && !keep.aliases.some((x) => norm(x) === norm(a))) keep.aliases.push(a);
    }
    bySci.delete(`${other.kind}|${norm(other.scientific_name)}`);
  }
}

const finalRows = [...bySci.values()].sort((a, b) =>
  a.kind.localeCompare(b.kind) || a.scientific_name.localeCompare(b.scientific_name) || a.qid.localeCompare(b.qid));

// ── Write migration ─────────────────────────────────────────────────────────

const sq = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const counts = finalRows.reduce((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {});

const header = `-- Migration 0004 — species catalog + optional species link on inhabitants
--
-- GENERATED by scripts/species/build-species.mjs — do not edit by hand; re-run the
-- script instead (it is deterministic for a given Wikidata snapshot).
--
-- Species data from Wikidata (https://www.wikidata.org), CC0 1.0. Extra hobby
-- names from scripts/species/aliases.json (original, AGPL-3.0 with the project).
--
-- Rows: ${finalRows.length} (${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ")})
--
-- aliases: JSON array of other English names and scientific synonyms.
-- popularity: Wikipedia sitelink count from Wikidata (+${CURATED_BOOST} for species curated in
-- aliases.json), used only to rank ties in search.
--
-- NOTE: the ALTER TABLE below is not idempotent (D1/SQLite has no
-- ADD COLUMN IF NOT EXISTS). That is fine because wrangler records applied
-- migrations in d1_migrations and never re-runs this file.

CREATE TABLE IF NOT EXISTS species (
  id              INTEGER PRIMARY KEY,
  qid             TEXT NOT NULL UNIQUE,          -- Wikidata item, e.g. Q131431
  kind            TEXT NOT NULL,                 -- 'fish' | 'invert' | 'plant'
  common_name     TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  aliases         TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
  popularity      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS species_common_idx     ON species(lower(common_name));
CREATE INDEX IF NOT EXISTS species_scientific_idx ON species(lower(scientific_name));
CREATE INDEX IF NOT EXISTS species_kind_idx       ON species(kind);

ALTER TABLE inhabitants ADD COLUMN species_id INTEGER REFERENCES species(id);
CREATE INDEX IF NOT EXISTS inhabitants_species_idx ON inhabitants(species_id);
`;

// Stable ids (1..n in sorted order) keep the file diff-friendly. INSERT OR IGNORE
// makes the data part safe to re-run.
const CHUNK = 100;
const inserts = [];
for (let i = 0; i < finalRows.length; i += CHUNK) {
  const chunk = finalRows.slice(i, i + CHUNK);
  inserts.push(
    `INSERT OR IGNORE INTO species (id, qid, kind, common_name, scientific_name, aliases, popularity) VALUES\n` +
    chunk.map((r, j) =>
      `  (${i + j + 1}, ${sq(r.qid)}, ${sq(r.kind)}, ${sq(r.common_name)}, ${sq(r.scientific_name)}, ${sq(JSON.stringify(r.aliases))}, ${r.popularity})`
    ).join(",\n") + ";"
  );
}

writeFileSync(OUT, `${header}\n${inserts.join("\n\n")}\n`);
console.log(`Wrote ${OUT}`);
console.log(`  ${finalRows.length} species:`, counts);

if (STATS) {
  for (const s of stats) console.log(`  ${s.kind.padEnd(6)} ${s.taxon.padEnd(20)} seen ${String(s.seen).padStart(5)}  kept ${s.kept}`);
}
