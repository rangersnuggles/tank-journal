export const runtime = "edge";
// Reads D1 on each request (public tanks change); never prerender at build time.
export const dynamic = "force-dynamic";

import { getDB } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

export default async function sitemap() {
  const pages = [
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.8 },
  ];

  let tanks = [];
  try {
    const { results } = await getDB()
      .prepare(
        `SELECT u.username, t.slug,
                COALESCE((SELECT MAX(e.created_at) FROM entries e WHERE e.tank_id = t.id), t.updated_at) AS last_modified
         FROM tanks t
         JOIN users u ON u.id = t.user_id
         WHERE t.is_public = 1 AND t.slug IS NOT NULL AND t.slug != ''
         ORDER BY t.id`
      )
      .all();
    tanks = results;
  } catch {
    // Never fail the whole sitemap on a DB hiccup; static pages are still useful.
  }

  return [
    ...pages,
    ...tanks.map((t) => {
      const lm = t.last_modified ? new Date(`${String(t.last_modified).replace(" ", "T")}Z`) : null;
      return {
        url: `${SITE_URL}/t/${encodeURIComponent(t.username)}/${encodeURIComponent(t.slug)}`,
        ...(lm && !Number.isNaN(lm.getTime()) ? { lastModified: lm } : {}),
        changeFrequency: "weekly",
        priority: 0.6,
      };
    }),
  ];
}
