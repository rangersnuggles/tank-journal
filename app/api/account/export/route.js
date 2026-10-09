export const runtime = "edge";

import { getDB } from "@/lib/db";
import { accountSession, jsonError } from "@/lib/account";
import { buildJsonExport, entriesToCsv, fileSlug, todayStamp } from "@/lib/export";

/**
 * GET /api/account/export?format=json            all tanks, entries, inhabitants
 * GET /api/account/export?format=csv&tank=<id>   one tank's entries, flattened
 */
export async function GET(request) {
  const { user, response } = await accountSession(request);
  if (response) return response;

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const db = getDB();

  try {
    if (format === "json") {
      const row = await db
        .prepare(`SELECT id, email, username, display_name, created_at FROM users WHERE id = ?`)
        .bind(user.user_id)
        .first();
      const data = await buildJsonExport(db, row);
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="aquaslog-export-${todayStamp()}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "csv") {
      const tankId = url.searchParams.get("tank");
      if (!tankId || !/^\d+$/.test(tankId)) {
        return jsonError("CSV export needs a tank: ?format=csv&tank=<id>", 400);
      }
      const tank = await db
        .prepare(`SELECT id, name, slug FROM tanks WHERE id = ? AND user_id = ?`)
        .bind(Number(tankId), user.user_id)
        .first();
      // 404 (not 403) so tank ids belonging to other users aren't confirmed.
      if (!tank) return jsonError("Tank not found", 404);

      const { results: entries } = await db
        .prepare(
          `SELECT * FROM entries WHERE tank_id = ?
           ORDER BY date ASC, time ASC, created_at ASC, id ASC`
        )
        .bind(tank.id)
        .all();

      return new Response(entriesToCsv(entries), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="aquaslog-${fileSlug(tank)}-${todayStamp()}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return jsonError("format must be json or csv", 400);
  } catch (err) {
    console.error("account/export error:", err);
    return jsonError("Internal server error", 500);
  }
}
