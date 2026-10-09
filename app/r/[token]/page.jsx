export const runtime = "edge";
export const dynamic = "force-dynamic";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { safeVerifyToken } from "@/lib/reminders/tokens";
import { getReminder, getUserSettings, lastDoneByTank } from "@/lib/reminders/service";
import { TASK_TYPES, reminderTitle } from "@/lib/reminders/match";
import { zonedParts, dueState, fmtShortDate, fmtAgo, diffDays, maxDate, fmtInterval } from "@/lib/reminders/dates";
import ReminderEmailAction, { EmailPageShell } from "@/components/ReminderEmailAction";

export const metadata = { title: "Reminder — AquaSlog", robots: { index: false } };

/**
 * Landing page for Done / Snooze links in reminder emails. Viewing it NEVER changes
 * anything (link scanners prefetch GETs) — the buttons POST to /api/email/action.
 */
export default async function ReminderLinkPage(props) {
  const { token } = await props.params;
  const tok = await safeVerifyToken(getRequestContext().env, decodeURIComponent(token));

  if (!tok.ok || !["done", "snooze"].includes(tok.action)) {
    return (
      <EmailPageShell title={tok.reason === "expired" ? "This link has expired" : "This link isn’t valid"}>
        Open AquaSlog to see your reminders.
      </EmailPageShell>
    );
  }

  const db = getDB();
  const reminder = await getReminder(db, tok.reminderId);
  if (!reminder || reminder.user_id !== tok.userId) {
    return <EmailPageShell title="Reminder not found">It may have been deleted.</EmailPageShell>;
  }
  const tank = await db.prepare(`SELECT name FROM tanks WHERE id = ?`).bind(reminder.tank_id).first();
  const { timezone } = await getUserSettings(db, reminder.user_id);
  const today = zonedParts(new Date(), timezone).date;
  const meta = TASK_TYPES[reminder.task_type] ?? TASK_TYPES.custom;
  const last = maxDate((await lastDoneByTank(db, [reminder.tank_id]))[reminder.tank_id]?.[reminder.task_type], reminder.last_done_on);

  const info = {
    title: reminderTitle(reminder),
    tankName: tank?.name ?? "",
    taskType: reminder.task_type,
    journalable: !!meta.journalable,
    entryHint: meta.entryHint,
    recurring: !!reminder.interval_days,
    every: reminder.interval_days ? `Every ${fmtInterval(reminder.interval_days)}` : "One-time reminder",
    dueLabel: dueState(reminder.due_date, today).label,
    dueKind: dueState(reminder.due_date, today).kind,
    lastLine: last && meta.lastLabel ? `${meta.lastLabel}: ${fmtShortDate(last, today)} (${fmtAgo(diffDays(today, last))})` : null,
    stale: reminder.status === "completed" || reminder.due_date !== tok.dueDate,
    currentDue: reminder.status === "completed" ? null : fmtShortDate(reminder.due_date, today),
    completed: reminder.status === "completed",
    defaultOp: tok.action,
  };
  return <ReminderEmailAction token={decodeURIComponent(token)} info={info} />;
}
