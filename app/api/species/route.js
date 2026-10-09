export const runtime = "edge";

import { getDB } from "@/lib/db";
import { searchSpecies, parseKinds, normalizeQuery } from "@/lib/species";

/**
 * GET /api/species?q=neon&kind=fish  (public)
 * Up to 10 catalog matches, ranked common-name prefix > word prefix > scientific > alias.
 * kind: fish | invert | plant (comma-separated for several; omit for all).
 * The catalog only changes with a deploy, so responses are cacheable.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const q = normalizeQuery(url.searchParams.get("q"));
  const kinds = parseKinds(url.searchParams.get("kind"));
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "10", 10) || 10, 1), 10);

  const results = q ? await searchSpecies(getDB(), q, { kinds, limit }) : [];
  return Response.json(results, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
