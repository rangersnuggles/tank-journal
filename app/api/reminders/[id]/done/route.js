export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { loadOwnReminder, markDone, getUserSettings } from "@/lib/reminders/service";
import { zonedParts } from "@/lib/reminders/dates";
import { isDateStr } from "@/lib/dates";

// POST { date?: "YYYY-MM-DD" } — the client's local date; falls back to the user's timezone.
export async function POST(request, { params }) {
  const { id } = await params;
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDB();
  const { reminder, error, status } = await loadOwnReminder(db, id, user);
  if (error) return Response.json({ error }, { status });
  if (reminder.status === "completed") return Response.json({ error: "Reminder already completed" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const date = isDateStr(body?.date) ? body.date : zonedParts(new Date(), (await getUserSettings(db, user.user_id)).timezone).date;
  const result = await markDone(db, reminder, { date, source: "app" });
  return Response.json(result);
}
