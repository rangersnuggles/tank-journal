"use client";

/**
 * Confirm pages for reminder-email links (/r/[token], /unsubscribe). Rendering never
 * changes state; the buttons POST with the signed token.
 */

import { useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";

const sans = "'DM Sans', sans-serif";
const serif = "'Lora', serif";

const primaryBtn = {
  background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: "7px",
  padding: "10px 18px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: sans,
};
const secondaryBtn = {
  background: "var(--color-bg)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)",
  borderRadius: "7px", padding: "9px 14px", fontSize: "13px", cursor: "pointer", fontFamily: sans,
};

export function EmailPageShell({ title, children, footer = true }) {
  return (
    <div style={{ maxWidth: "460px", width: "100%", margin: "0 auto", padding: "56px 20px 80px", fontFamily: sans }}>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: "24px", color: "var(--color-text-primary)", marginBottom: "22px" }}>AquaSlog</div>
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "12px", padding: "24px" }}>
        {title && <h1 style={{ fontFamily: serif, fontSize: "21px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 10px" }}>{title}</h1>}
        <div style={{ fontSize: "14px", color: "var(--color-text-body)", lineHeight: 1.6 }}>{children}</div>
      </div>
      {footer && (
        <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", marginTop: "18px", textAlign: "center" }}>
          <Link href="/dashboard" style={{ color: "var(--color-text-subtle)" }}>Open AquaSlog</Link>
          {" · "}
          <Link href="/account/notifications" style={{ color: "var(--color-text-subtle)" }}>Email settings</Link>
        </p>
      )}
    </div>
  );
}

const CHIP = {
  overdue: { background: "var(--color-error-bg)", color: "var(--color-error-text)", border: "1px solid var(--color-error-border)" },
  today:   { background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning-border)" },
};

export default function ReminderEmailAction({ token, info }) {
  const [addEntry, setAddEntry] = useState(info.journalable && info.taskType !== "test_water");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { kind: "done"|"snoozed"|"stale"|"error", text }

  async function post(op, days) {
    setBusy(true);
    try {
      const res = await fetch("/api/email/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, op, days, add_entry: op === "done" && addEntry }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setResult({ kind: "stale", text: "This reminder was already updated." });
      } else if (!res.ok) {
        setResult({ kind: "error", text: data.error || "Something went wrong." });
      } else if (op === "done") {
        posthog.capture("reminder_completed", { task_type: info.taskType, recurring: info.recurring, source: "email", added_entry: !!data.entry_id });
        const due = data.reminder?.due_date;
        setResult({
          kind: "done",
          text: data.completed ? `${info.title} marked done.` : `${info.title} marked done — next due ${fmt(due)}.`,
          extra: data.entry_id ? "Added to your journal." : null,
        });
      } else {
        posthog.capture("reminder_snoozed", { task_type: info.taskType, days, source: "email" });
        setResult({ kind: "snoozed", text: `Snoozed — ${info.title} is now due ${fmt(data.reminder?.due_date)}.` });
      }
    } catch {
      setResult({ kind: "error", text: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }

  if (info.stale || result?.kind === "stale") {
    return (
      <EmailPageShell title="Already taken care of">
        <p style={{ margin: 0 }} data-testid="action-stale">
          {info.completed ? `${info.title} (${info.tankName}) is already completed.` : `${info.title} (${info.tankName}) was already updated${info.currentDue ? ` — it’s now due ${info.currentDue}` : ""}.`}
        </p>
      </EmailPageShell>
    );
  }

  if (result && result.kind !== "error") {
    return (
      <EmailPageShell title={result.kind === "done" ? "Nice work" : "Snoozed"}>
        <p style={{ margin: 0 }} data-testid="action-result">{result.text}</p>
        {result.extra && <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--color-text-muted)" }}>{result.extra}</p>}
      </EmailPageShell>
    );
  }

  const snoozeFirst = info.defaultOp === "snooze";
  const doneBlock = (
    <div key="done" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <button type="button" onClick={() => post("done")} disabled={busy} data-testid="confirm-done" style={snoozeFirst ? { ...secondaryBtn, alignSelf: "flex-start" } : { ...primaryBtn, alignSelf: "flex-start" }}>
        ✓ Mark done{info.recurring ? "" : " (complete)"}
      </button>
      {info.journalable && (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--color-text-body)", cursor: "pointer" }}>
          <input type="checkbox" checked={addEntry} onChange={(e) => setAddEntry(e.target.checked)} data-testid="add-entry" style={{ accentColor: "#0891b2", width: "15px", height: "15px" }} />
          Also add to journal ({info.entryHint})
        </label>
      )}
    </div>
  );
  const snoozeBlock = (
    <div key="snooze">
      <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "6px" }}>Snooze</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {[1, 3, 7].map((d) => (
          <button key={d} type="button" onClick={() => post("snooze", d)} disabled={busy} data-testid={`snooze-${d}`} style={snoozeFirst && d === 1 ? { ...primaryBtn, padding: "9px 14px", fontSize: "13px" } : secondaryBtn}>
            {d === 1 ? "1 day" : `${d} days`}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <EmailPageShell title={info.title}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
        <span style={{ color: "var(--color-text-secondary)" }}>{info.tankName}</span>
        <span style={{ ...(CHIP[info.dueKind] ?? { color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }), borderRadius: "4px", padding: "1px 7px", fontSize: "11px", fontWeight: 600 }}>{info.dueLabel}</span>
      </div>
      {info.lastLine && <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{info.lastLine}</div>}
      <div style={{ fontSize: "12px", color: "var(--color-text-subtle)", marginBottom: "20px" }}>{info.every}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "18px" }}>
        {snoozeFirst ? [snoozeBlock, doneBlock] : [doneBlock, snoozeBlock]}
      </div>
      {result?.kind === "error" && <p role="alert" style={{ color: "var(--color-error-text)", fontSize: "13px", margin: "14px 0 0" }}>{result.text}</p>}
    </EmailPageShell>
  );
}

function fmt(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function UnsubscribeConfirm({ token, maskedEmail, alreadyOff }) {
  const [state, setState] = useState(alreadyOff ? "done" : "idle"); // idle | busy | done | error

  async function confirm() {
    setState("busy");
    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      setState(res.ok ? "done" : "error");
      if (res.ok) posthog.capture("notification_prefs_updated", { reminders_email: false, source: "unsubscribe_link" });
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <EmailPageShell title="You’re unsubscribed">
        <p style={{ margin: 0 }} data-testid="unsubscribed">
          {maskedEmail} won’t get reminder emails any more. Your reminders still show in the app, and you can turn emails back on in email settings.
        </p>
      </EmailPageShell>
    );
  }
  return (
    <EmailPageShell title="Unsubscribe from reminder emails?">
      <p style={{ margin: "0 0 18px" }}>Stop sending daily reminder emails to {maskedEmail}. Your reminders stay in the app.</p>
      <button type="button" onClick={confirm} disabled={state === "busy"} data-testid="confirm-unsubscribe" style={primaryBtn}>
        {state === "busy" ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      {state === "error" && <p role="alert" style={{ color: "var(--color-error-text)", fontSize: "13px", margin: "12px 0 0" }}>Something went wrong — try again.</p>}
    </EmailPageShell>
  );
}
