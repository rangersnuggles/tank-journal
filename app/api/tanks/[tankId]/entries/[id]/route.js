export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession, unauthorized } from "@/lib/session";
import { ENTRY_TYPE_KEYS, isValidEntryType } from "@/lib/entryTypes";
import { autoResetFromEntry } from "@/lib/reminders/service";

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
  const user = await getSession(request);
  if (!user) return unauthorized();
  const db = getDB();

  const { error, status } = await resolveEntry(db, tankId, id, user.user_id);
  if (error) return Response.json({ error }, { status });

  const body = await request.json();
  if ("type" in body && !isValidEntryType(body.type)) {
    return Response.json(
      { error: `type must be one of: ${ENTRY_TYPE_KEYS.join(", ")}` },
      { status: 400 }
    );
  }
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
  const entry = { ...row, data: typeof row.data === "string" ? JSON.parse(row.data) : row.data };
  // An edit can newly satisfy a reminder (e.g. ticking "Water change"); only moves due dates forward.
  const reminders_reset = await autoResetFromEntry(db, { userId: user.user_id, tankId: Number(tankId), entry });
  return Response.json({ ...entry, reminders_reset });
}

export async function DELETE(request, { params }) {
  const { tankId, id } = await params;
  const user = await getSession(request);
  if (!user) return unauthorized();
  const db = getDB();

  const { error, status } = await resolveEntry(db, tankId, id, user.user_id);
  if (error) return Response.json({ error }, { status });

  await db
    .prepare(`DELETE FROM entries WHERE id = ? AND tank_id = ?`)
    .bind(id, tankId)
    .run();

  return new Response(null, { status: 204 });
}
