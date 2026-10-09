export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { safeVerifyToken } from "@/lib/reminders/tokens";
import {
  getReminder, getUserSettings, markDone, snooze, createEntryForReminder, autoResetFromEntry, SNOOZE_DAYS,
} from "@/lib/reminders/service";
import { TASK_TYPES } from "@/lib/reminders/match";
import { zonedParts } from "@/lib/reminders/dates";

/**
 * POST { token, op: "done"|"snooze", days?: 1|3|7, add_entry?: boolean }
 *
 * Called by the /r/[token] confirm page (links in emails never change state on GET).
 * The signed token authorizes acting on one reminder for one user, pinned to the due
 * date at send time — once the reminder has moved, the link is a no-op (409).
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body?.token) return Response.json({ error: "Missing token" }, { status: 400 });

  const env = getRequestContext().env;
  const tok = await safeVerifyToken(env, body.token);
  if (!tok.ok || !["done", "snooze"].includes(tok.action) || !tok.reminderId) {
    return Response.json({ error: tok.reason === "expired" ? "This link has expired." : "This link is not valid." }, { status: 400 });
  }

  const db = getDB();
  const reminder = await getReminder(db, tok.reminderId);
  if (!reminder || reminder.user_id !== tok.userId) return Response.json({ error: "This reminder no longer exists." }, { status: 404 });
  if (reminder.status === "completed" || reminder.due_date !== tok.dueDate) {
    return Response.json({ error: "already_handled", reminder }, { status: 409 });
  }

  const { timezone } = await getUserSettings(db, tok.userId);
  const local = zonedParts(new Date(), timezone);

  if (body.op === "snooze") {
    const days = Number(body.days);
    if (!SNOOZE_DAYS.includes(days)) return Response.json({ error: "days must be 1, 3 or 7" }, { status: 400 });
    const res = await snooze(db, reminder, { days, today: local.date, source: "email", expectDue: tok.dueDate });
    if (!res.changed) return Response.json({ error: "already_handled", reminder: res.reminder }, { status: 409 });
    return Response.json({ ok: true, op: "snooze", reminder: res.reminder });
  }

  if (body.op !== "done") return Response.json({ error: "op must be done or snooze" }, { status: 400 });

  const res = await markDone(db, reminder, { date: local.date, source: "email", expectDue: tok.dueDate });
  if (!res.changed) return Response.json({ error: "already_handled", reminder: res.reminder }, { status: 409 });

  let entry = null;
  if (body.add_entry && TASK_TYPES[reminder.task_type]?.journalable) {
    entry = await createEntryForReminder(db, reminder, { date: local.date, time: local.time });
    if (entry) {
      await db
        .prepare(`UPDATE reminder_log SET entry_id = ? WHERE id = (SELECT MAX(id) FROM reminder_log WHERE reminder_id = ?)`)
        .bind(entry.id, reminder.id)
        .run();
      // Other auto-reset reminders on the tank (this one is skipped: last_done_on is today).
      await autoResetFromEntry(db, { userId: reminder.user_id, tankId: reminder.tank_id, entry });
    }
  }
  return Response.json({ ok: true, op: "done", reminder: res.reminder, completed: res.completed, entry_id: entry?.id ?? null });
}
