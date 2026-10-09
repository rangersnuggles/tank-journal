export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  listTankReminders, lastDoneByTank, validateReminderInput, createReminder, captureTimezone,
} from "@/lib/reminders/service";

// Reminders are always private — owner only, even on public tanks.
// (/api/tanks/* is a public middleware prefix, so check the session here and 401 cleanly.)
async function ownTank(db, tankId, user) {
  if (!user) return { error: "Unauthorized", status: 401 };
  const tank = await db.prepare(`SELECT id, user_id FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return { error: "Tank not found", status: 404 };
  if (tank.user_id !== user.user_id) return { error: "Forbidden", status: 403 };
  return { tank };
}

export async function GET(request, { params }) {
  const { tankId } = await params;
  const user = await getSession(request);
  const db = getDB();
  const { error, status } = await ownTank(db, tankId, user);
  if (error) return Response.json({ error }, { status });

  const [reminders, last] = await Promise.all([
    listTankReminders(db, tankId, user.user_id),
    lastDoneByTank(db, [tankId]),
  ]);
  return Response.json({ reminders, last_done: last[Number(tankId)] ?? {} });
}

export async function POST(request, { params }) {
  const { tankId } = await params;
  const user = await getSession(request);
  const db = getDB();
  const { error, status } = await ownTank(db, tankId, user);
  if (error) return Response.json({ error }, { status });

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const v = validateReminderInput(body);
  if (v.error) return Response.json({ error: v.error }, { status: 400 });

  // Learn the user's timezone silently the first time they create a reminder.
  if (body.timezone) await captureTimezone(db, user.user_id, body.timezone).catch(() => {});

  const reminder = await createReminder(db, { userId: user.user_id, tankId: Number(tankId), values: v.values });
  return Response.json(reminder, { status: 201 });
}
