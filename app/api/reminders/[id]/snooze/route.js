export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { loadOwnReminder, snooze, getUserSettings, SNOOZE_DAYS } from "@/lib/reminders/service";
import { zonedParts } from "@/lib/reminders/dates";
import { isDateStr } from "@/lib/dates";

// POST { days: 1|3|7, today?: "YYYY-MM-DD" }
export async function POST(request, { params }) {
  const { id } = await params;
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDB();
  const { reminder, error, status } = await loadOwnReminder(db, id, user);
  if (error) return Response.json({ error }, { status });
  if (reminder.status !== "active") return Response.json({ error: "Only active reminders can be snoozed" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const days = Number(body?.days);
  if (!SNOOZE_DAYS.includes(days)) return Response.json({ error: "days must be 1, 3 or 7" }, { status: 400 });
  const today = isDateStr(body?.today) ? body.today : zonedParts(new Date(), (await getUserSettings(db, user.user_id)).timezone).date;
  return Response.json(await snooze(db, reminder, { days, today, source: "app" }));
}
