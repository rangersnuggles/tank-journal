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
    .prepare(
      `SELECT * FROM entries WHERE tank_id = ?
       ORDER BY date DESC, created_at DESC`
    )
    .bind(tankId)
    .all();

  // Parse JSON data field for each row
  const entries = results.map((row) => ({
    ...row,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  }));

  return Response.json(entries);
}

export async function POST(request, { params }) {
  const { tankId } = await params;
  const user = await requireSession(request);
  const db = getDB();

  // Verify ownership (only owner can write)
  const tank = await db.prepare(`SELECT user_id FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return Response.json({ error: "Tank not found" }, { status: 404 });
  if (tank.user_id !== user.user_id) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { type, date, time, data, note } = await request.json();
  if (!type || !date || !time) {
    return Response.json({ error: "type, date, and time are required" }, { status: 400 });
  }

  const { meta } = await db
    .prepare(
      `INSERT INTO entries (tank_id, type, date, time, data, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(tankId, type, date, time, JSON.stringify(data ?? {}), note ?? null)
    .run();

  const row = await db
    .prepare(`SELECT * FROM entries WHERE id = ?`)
    .bind(meta.last_row_id)
    .first();

  return Response.json(
    { ...row, data: typeof row.data === "string" ? JSON.parse(row.data) : row.data },
    { status: 201 }
  );
}
