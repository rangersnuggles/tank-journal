export const runtime = "edge";

import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";

async function resolveEntry(db, tankId, id, userId) {
  const tank = await db.prepare(`SELECT user_id FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return { error: "Tank not found", status: 404 };
  if (tank.user_id !== userId) return { error: "Forbidden", status: 403 };

  const entry = await db
    .prepare(`SELECT * FROM entries WHERE id = ? AND tank_id = ?`)
    .bind(id, tankId)
    .first();
  if (!entry) return { error: "Entry not found", status: 404 };

  return { entry };
}

export async function PATCH(request, { params }) {
  const { tankId, id } = await params;
  const user = await requireSession(request);
  const db = getDB();

  const { error, status } = await resolveEntry(db, tankId, id, user.user_id);
  if (error) return Response.json({ error }, { status });

  const body = await request.json();
  const allowed = ["type", "date", "time", "data", "note"];
  const updates = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = key === "data" ? JSON.stringify(body[key]) : body[key];
    }
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(updates), id, tankId];

  await db
    .prepare(`UPDATE entries SET ${setClauses} WHERE id = ? AND tank_id = ?`)
    .bind(...values)
    .run();

  const row = await db.prepare(`SELECT * FROM entries WHERE id = ?`).bind(id).first();
  return Response.json({
    ...row,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  });
}

export async function DELETE(request, { params }) {
  const { tankId, id } = await params;
  const user = await requireSession(request);
  const db = getDB();

  const { error, status } = await resolveEntry(db, tankId, id, user.user_id);
  if (error) return Response.json({ error }, { status });

  await db
    .prepare(`DELETE FROM entries WHERE id = ? AND tank_id = ?`)
    .bind(id, tankId)
    .run();

  return new Response(null, { status: 204 });
}
