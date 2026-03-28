export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession, requireSession } from "@/lib/session";

async function resolveTank(db, tankId, user) {
  const tank = await db.prepare(`SELECT * FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return { error: "Tank not found", status: 404 };
  if (!tank.is_public) {
    if (!user || user.user_id !== tank.user_id) {
      return { error: "Forbidden", status: 403 };
    }
  }
  return { tank };
}

export async function GET(request, { params }) {
  const { tankId } = await params;
  const db = getDB();
  const user = await getSession(request);

  const { error, status } = await resolveTank(db, tankId, user);
  if (error) return Response.json({ error }, { status });

  const { results } = await db
    .prepare(`SELECT * FROM inhabitants WHERE tank_id = ? ORDER BY created_at ASC`)
    .bind(tankId)
    .all();

  return Response.json(results);
}

export async function POST(request, { params }) {
  const { tankId } = await params;
  const user = await requireSession(request);
  const db = getDB();

  const tank = await db.prepare(`SELECT user_id FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return Response.json({ error: "Tank not found" }, { status: 404 });
  if (tank.user_id !== user.user_id) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { name, count, date_added, notes } = await request.json();
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  const { meta } = await db
    .prepare(
      `INSERT INTO inhabitants (tank_id, name, count, date_added, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(tankId, name, count ?? null, date_added ?? new Date().toISOString().slice(0, 10), notes ?? null)
    .run();

  const row = await db
    .prepare(`SELECT * FROM inhabitants WHERE id = ?`)
    .bind(meta.last_row_id)
    .first();

  return Response.json(row, { status: 201 });
}
