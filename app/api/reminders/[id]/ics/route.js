export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { loadOwnReminder, getUserSettings } from "@/lib/reminders/service";
import { renderReminderIcs, getCalendarAlarm } from "@/lib/calendar/feed";
import { icsFilename } from "@/lib/calendar/ics";

// GET → single-event .ics (attachment) for the reminder's next due date. Owner only.
export async function GET(request, { params }) {
  const { id } = await params;
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDB();
  const { reminder, error, status } = await loadOwnReminder(db, id, user);
  if (error) return Response.json({ error }, { status });
  if (reminder.status === "completed") return Response.json({ error: "Reminder already completed" }, { status: 409 });

  const tank = await db.prepare(`SELECT name FROM tanks WHERE id = ?`).bind(reminder.tank_id).first();
  const row = { ...reminder, tank_name: tank?.name ?? "Tank" };
  const { timezone } = await getUserSettings(db, user.user_id);
  const alarm = await getCalendarAlarm(db, user.user_id);
  const body = await renderReminderIcs(db, row, { timezone, alarm, origin: new URL(request.url).origin });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(row)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
