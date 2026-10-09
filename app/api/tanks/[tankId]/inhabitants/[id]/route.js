export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession, unauthorized } from "@/lib/session";
import { INHABITANT_SELECT, validateSpeciesId } from "@/lib/species";

async function resolveInhabitant(db, tankId, id, userId) {
  const tank = await db.prepare(`SELECT user_id FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return { error: "Tank not found", status: 404 };
  if (tank.user_id !== userId) return { error: "Forbidden", status: 403 };

  const inhabitant = await db
    .prepare(`SELECT * FROM inhabitants WHERE id = ? AND tank_id = ?`)
    .bind(id, tankId)
    .first();
  if (!inhabitant) return { error: "Inhabitant not found", status: 404 };

  return { inhabitant };
}

export async function PATCH(request, { params }) {
  const { tankId, id } = await params;
  const user = await getSession(request);
  if (!user) return unauthorized();
  const db = getDB();

  const { error, status } = await resolveInhabitant(db, tankId, id, user.user_id);
  if (error) return Response.json({ error }, { status });

  const body = await request.json();
  const allowed = ["name", "count", "date_added", "notes", "species_id"];
  const updates = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if ("species_id" in updates) {
    const species = await validateSpeciesId(db, updates.species_id);
    if (species.error) return Response.json({ error: species.error }, { status: 400 });
    updates.species_id = species.value;
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(updates), id, tankId];

  await db
    .prepare(`UPDATE inhabitants SET ${setClauses} WHERE id = ? AND tank_id = ?`)
    .bind(...values)
    .run();

  const row = await db
    .prepare(`${INHABITANT_SELECT} WHERE i.id = ?`)
    .bind(id)
    .first();

  return Response.json(row);
}

export async function DELETE(request, { params }) {
  const { tankId, id } = await params;
  const user = await getSession(request);
  if (!user) return unauthorized();
  const db = getDB();

  const { error, status } = await resolveInhabitant(db, tankId, id, user.user_id);
  if (error) return Response.json({ error }, { status });

  await db
    .prepare(`DELETE FROM inhabitants WHERE id = ? AND tank_id = ?`)
    .bind(id, tankId)
    .run();

  return new Response(null, { status: 204 });
}
