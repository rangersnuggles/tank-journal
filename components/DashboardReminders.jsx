"use client";

/**
 * Dashboard reminder bits: the "Up next" list above the tank grid and the per-card
 * due-count chip + "Last water change" line.
 *
 * The server passes `today` computed in the user's saved timezone; after mount we
 * switch to the browser's local date (same value in the common case, no hydration
 * mismatch either way).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { localDateStr } from "@/lib/dates";
import { addDays, diffDays, dueState, fmtAgo, fmtShortDate } from "@/lib/reminders/dates";
import { reminderTitle } from "@/lib/reminders/match";
import { DueChip } from "./RemindersCard";

const sans = "'DM Sans', sans-serif";
const UP_NEXT_DAYS = 7;
const UP_NEXT_MAX = 6;

function useToday(serverToday) {
  const [today, setToday] = useState(serverToday);
  useEffect(() => { setToday(localDateStr()); }, []);
  return today;
}

/** reminders: [{ id, tank_id, tank_name, task_type, title, due_date, interval_days }] (active only) */
export function UpNext({ reminders, today: serverToday }) {
  const today = useToday(serverToday);
  if (!reminders?.length) return null;
  const horizon = addDays(today, UP_NEXT_DAYS);
  const soon = reminders.filter((r) => r.due_date <= horizon);
  const shown = soon.slice(0, UP_NEXT_MAX);
  const next = reminders.find((r) => r.due_date > horizon);

  return (
    <section data-testid="up-next" aria-labelledby="up-next-h" style={{ marginBottom: "28px", fontFamily: sans }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
        <h2 id="up-next-h" style={{ fontFamily: "'Lora', serif", fontSize: "17px", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>Up next</h2>
        <Link href="/account/notifications" style={{ fontSize: "11px", color: "var(--color-text-subtle)", textDecoration: "none" }}>Email reminders</Link>
      </div>
      <div style={{ border: "1px solid var(--color-border-faint)", borderRadius: "10px", background: "var(--color-bg)", overflow: "hidden" }}>
        {shown.length === 0 && (
          <div style={{ padding: "12px 16px", fontSize: "12px", color: "var(--color-text-subtle)" }}>
            Nothing due this week.{next ? ` Next: ${reminderTitle(next)} (${next.tank_name}) on ${fmtShortDate(next.due_date, today)}.` : ""}
          </div>
        )}
        {shown.map((r, i) => (
          <Link key={r.id} href={`/tanks/${r.tank_id}`} data-testid="up-next-row" style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", textDecoration: "none",
            borderTop: i ? "1px solid var(--color-border-subtle)" : "none",
          }}>
            <DueChip dueDate={r.due_date} today={today} compact />
            <span style={{ fontSize: "13px", color: "var(--color-text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reminderTitle(r)}</span>
            <span style={{ fontSize: "12px", color: "var(--color-text-subtle)", marginLeft: "auto", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "45%" }}>{r.tank_name}</span>
          </Link>
        ))}
        {soon.length > shown.length && (
          <div style={{ padding: "8px 16px", fontSize: "11px", color: "var(--color-text-subtle)", borderTop: "1px solid var(--color-border-subtle)" }}>
            +{soon.length - shown.length} more this week
          </div>
        )}
      </div>
    </section>
  );
}

/** Per tank card: "2 due" chip + "Last water change: 6 weeks ago". */
export function TankCardStatus({ reminders = [], lastWaterChange, today: serverToday }) {
  const today = useToday(serverToday);
  const due = reminders.filter((r) => r.due_date <= today);
  const overdue = due.some((r) => dueState(r.due_date, today).kind === "overdue");
  if (!due.length && !lastWaterChange) return null;
  return (
    <div data-testid="tank-card-status" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px", fontSize: "11px", fontFamily: sans }}>
      {due.length > 0 && (
        <span data-testid="due-count" title={due.map(reminderTitle).join(", ")} style={{
          borderRadius: "4px", padding: "1px 7px", fontWeight: 600, fontSize: "10px",
          background: overdue ? "var(--color-error-bg)" : "var(--color-warning-bg)",
          color: overdue ? "var(--color-error-text)" : "var(--color-warning-text)",
          border: `1px solid ${overdue ? "var(--color-error-border)" : "var(--color-warning-border)"}`,
        }}>{due.length} due{overdue ? " · overdue" : " today"}</span>
      )}
      {lastWaterChange && (
        <span style={{ color: "var(--color-text-muted)" }}>
          Last water change: {fmtAgo(diffDays(today, lastWaterChange))}
        </span>
      )}
    </div>
  );
}
