export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession, requireSession } from "@/lib/session";

async function getTankForUser(db, tankId, userId) {
  const tank = await db.prepare(`SELECT * FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return { error: "Tank not found", status: 404 };
  if (tank.user_id !== userId) return { error: "Forbidden", status: 403 };
  return { tank };
}

export async function GET(request, { params }) {
  const { tankId } = await params;
  const db = getDB();

  const tank = await db.prepare(`SELECT * FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return Response.json({ error: "Tank not found" }, { status: 404 });

  // Public tanks can be read without auth
  if (!tank.is_public) {
    const user = await getSession(request);
    if (!user || user.user_id !== tank.user_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return Response.json(tank);
}

export async function PATCH(request, { params }) {
  const { tankId } = await params;
  const user = await requireSession(request);
  const db = getDB();

  const { error, status, tank } = await getTankForUser(db, tankId, user.user_id);
  if (error) return Response.json({ error }, { status });

  const body = await request.json();
  const allowed = ["name", "description", "slug", "is_public"];
  const updates = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = key === "is_public" ? (body[key] ? 1 : 0) : body[key];
    }
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(updates), tankId];

  try {
    await db
      .prepare(`UPDATE tanks SET ${setClauses} WHERE id = ?`)
      .bind(...values)
      .run();
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return Response.json({ error: "You already have a tank with that slug" }, { status: 409 });
    }
    throw err;
  }

  const updated = await db.prepare(`SELECT * FROM tanks WHERE id = ?`).bind(tankId).first();
  return Response.json(updated);
}

export async function DELETE(request, { params }) {
  const { tankId } = await params;
  const user = await requireSession(request);
  const db = getDB();

  const { error, status } = await getTankForUser(db, tankId, user.user_id);
  if (error) return Response.json({ error }, { status });

  // CASCADE in schema handles entries + inhabitants deletion
  await db.prepare(`DELETE FROM tanks WHERE id = ?`).bind(tankId).run();
  return new Response(null, { status: 204 });
}
