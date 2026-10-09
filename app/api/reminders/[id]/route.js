export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { loadOwnReminder, validateReminderInput, updateReminder, deleteReminder } from "@/lib/reminders/service";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDB();
  const { reminder, error, status } = await loadOwnReminder(db, id, user);
  if (error) return Response.json({ error }, { status });

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const v = validateReminderInput(body, { partial: true, current: reminder });
  if (v.error) return Response.json({ error: v.error }, { status: 400 });
  if (Object.keys(v.values).length === 0) return Response.json({ error: "No valid fields to update" }, { status: 400 });

  return Response.json(await updateReminder(db, reminder, v.values));
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDB();
  const { reminder, error, status } = await loadOwnReminder(db, id, user);
  if (error) return Response.json({ error }, { status });
  await deleteReminder(db, reminder);
  return new Response(null, { status: 204 });
}
