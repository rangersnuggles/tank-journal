export const runtime = "edge";

import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function GET(request) {
  const user = await requireSession(request);
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT t.*,
        (SELECT COUNT(*) FROM entries e WHERE e.tank_id = t.id) as entry_count
       FROM tanks t
       WHERE t.user_id = ?
       ORDER BY t.created_at ASC`
    )
    .bind(user.user_id)
    .all();
  return Response.json(results);
}

export async function POST(request) {
  const user = await requireSession(request);
  const { name, description, slug, is_public } = await request.json();

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (slug && !/^[a-z0-9_-]+$/i.test(slug)) {
    return Response.json(
      { error: "Slug may only contain letters, numbers, hyphens, and underscores" },
      { status: 400 }
    );
  }

  const db = getDB();
  try {
    const { meta } = await db
      .prepare(
        `INSERT INTO tanks (user_id, name, description, slug, is_public)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(user.user_id, name, description ?? null, slug ? slug.toLowerCase() : null, is_public ? 1 : 0)
      .run();

    const tank = await db
      .prepare(`SELECT * FROM tanks WHERE id = ?`)
      .bind(meta.last_row_id)
      .first();

    return Response.json(tank, { status: 201 });
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return Response.json({ error: "You already have a tank with that slug" }, { status: 409 });
    }
    throw err;
  }
}
