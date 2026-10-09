export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { normalizeQuery } from "@/lib/species";

/**
 * GET /api/me/names?q=amano  (session required)
 *
 * Names this user has used before, across all their tanks: inhabitant names,
 * Plant / Livestock entry subjects and Medical entry fish. Variants that differ
 * only in case/whitespace are grouped (the most-used spelling wins) and ordered
 * by prefix > word-prefix > contains, then frequency. Empty q returns the most
 * used names. species_id is the catalog link most often attached to that name.
 */
export async function GET(request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const q = normalizeQuery(url.searchParams.get("q"));
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "8", 10) || 8, 1), 20);
  const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

  const { results } = await getDB()
    .prepare(
      `WITH names(name, species_id) AS (
         SELECT trim(i.name), i.species_id
           FROM inhabitants i JOIN tanks t ON t.id = i.tank_id
          WHERE t.user_id = ?1
         UNION ALL
         SELECT trim(json_extract(e.data, '$.subject')), json_extract(e.data, '$.speciesId')
           FROM entries e JOIN tanks t ON t.id = e.tank_id
          WHERE t.user_id = ?1 AND e.type = 'changes'
         UNION ALL
         SELECT trim(json_extract(e.data, '$.fish')), json_extract(e.data, '$.fishSpeciesId')
           FROM entries e JOIN tanks t ON t.id = e.tank_id
          WHERE t.user_id = ?1 AND e.type = 'medical'
       )
       SELECT name, species_id, COUNT(*) AS n
         FROM names
        WHERE name IS NOT NULL AND name <> '' AND lower(name) LIKE ?2 ESCAPE '\\'
        GROUP BY name, species_id`
    )
    .bind(user.user_id, like)
    .all();

  // Group case/whitespace variants; pick the most-used spelling and species link.
  const groups = new Map();
  for (const r of results) {
    const key = r.name.toLowerCase().replace(/\s+/g, " ");
    const g = groups.get(key) ?? { key, total: 0, spellings: new Map(), species: new Map() };
    g.total += r.n;
    g.spellings.set(r.name, (g.spellings.get(r.name) ?? 0) + r.n);
    const sid = Number(r.species_id);
    if (Number.isInteger(sid) && sid > 0) g.species.set(sid, (g.species.get(sid) ?? 0) + r.n);
    groups.set(key, g);
  }
  // Most used wins; on a tie prefer a capitalized spelling ("Amano shrimp" over "amano shrimp").
  const capitalized = (k) => (typeof k === "string" && /^[A-Z]/.test(k) ? 0 : 1);
  const top = (m) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || capitalized(a[0]) - capitalized(b[0]) || String(a[0]).localeCompare(String(b[0])))[0]?.[0] ?? null;
  const tier = (key) => (!q ? 0 : key.startsWith(q) ? 0 : new RegExp(`[\\s\\-'(]${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(key) ? 1 : 2);

  const names = [...groups.values()]
    .map((g) => ({ name: top(g.spellings), count: g.total, species_id: top(g.species), tier: tier(g.key) }))
    .sort((a, b) => a.tier - b.tier || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ tier: _t, ...rest }) => rest);

  return Response.json(names, { headers: { "Cache-Control": "private, no-store" } });
}
