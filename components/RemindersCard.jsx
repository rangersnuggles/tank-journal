"use client";

/**
 * Tank sidebar "Reminders" card (owner only — reminders are private even on public tanks).
 *
 *   <RemindersCard tankId entries resetEvent onRemindersChange />
 *
 * - `resetEvent` ({ items, at }) is set by TankJournal when an entry save returns
 *   `reminders_reset`; the card reloads and toasts "Water change reminder reset — next due …".
 * Also exports <ReminderResetHint> for the entry form. "Last water change" lives in <TankGlance>.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { localDateStr } from "@/lib/dates";
import { addDays, dueState, fmtInterval, fmtShortDate, maxDate } from "@/lib/reminders/dates";
import { TASK_TYPES, TASK_TYPE_KEYS, reminderTitle, taskTypesForEntry, lastDoneFromEntries } from "@/lib/reminders/match";

const sans = "'DM Sans', sans-serif";

const inputStyle = {
  padding: "6px 8px", border: "1px solid var(--color-border)", borderRadius: "6px",
  fontSize: "12px", background: "var(--color-surface)", color: "var(--color-input-text)",
  outline: "none", width: "100%", boxSizing: "border-box", fontFamily: sans,
};
const smallBtn = {
  background: "none", border: "1px solid var(--color-border)", borderRadius: "5px",
  padding: "2px 8px", fontSize: "11px", color: "var(--color-text-muted)", cursor: "pointer",
  fontFamily: sans, lineHeight: 1.6,
};

const CHIP_STYLES = {
  overdue: { background: "var(--color-error-bg)", color: "var(--color-error-text)", border: "1px solid var(--color-error-border)" },
  today:   { background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning-border)" },
  soon:    { background: "var(--color-surface-raised)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" },
  later:   { background: "transparent", color: "var(--color-text-subtle)", border: "1px solid var(--color-border)" },
  paused:  { background: "transparent", color: "var(--color-text-subtle)", border: "1px dashed var(--color-border)" },
};

export function DueChip({ dueDate, today, paused = false, compact = false }) {
  const s = paused ? { kind: "paused", label: "Paused" } : dueState(dueDate, today);
  const label = compact && s.kind !== "paused"
    ? (s.kind === "overdue" ? `${-s.days}d overdue` : s.kind === "today" ? "Today" : `in ${s.days}d`)
    : s.label;
  return (
    <span data-testid="due-chip" data-kind={s.kind} title={paused ? undefined : `Due ${fmtShortDate(dueDate, today)}`} style={{
      ...CHIP_STYLES[s.kind], borderRadius: "4px", padding: "1px 6px", fontSize: "10px",
      fontWeight: 600, fontFamily: sans, whiteSpace: "nowrap", flexShrink: 0,
    }}>{label}</span>
  );
}

/** Hint under the entry form: "↻ Will reset your Water change reminder." */
export function ReminderResetHint({ reminders, type, data }) {
  const types = taskTypesForEntry({ type, data });
  if (!types.length || !reminders?.length) return null;
  const hits = reminders.filter((r) => r.status === "active" && r.auto_reset && types.includes(r.task_type));
  if (!hits.length) return null;
  const names = hits.map((r) => reminderTitle(r));
  return (
    <p data-testid="reminder-reset-hint" style={{ margin: "10px 0 0", fontSize: "11px", color: "var(--color-accent)", fontFamily: sans }}>
      ↻ Will reset your {names.join(" and ")} reminder{hits.length > 1 ? "s" : ""}.
    </p>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div role="status" data-testid="reminder-toast" style={{
      position: "fixed", left: "50%", bottom: "24px", transform: "translateX(-50%)", zIndex: 50,
      background: "var(--color-btn-dark-bg)", color: "var(--color-btn-dark-text)",
      borderRadius: "8px", padding: "10px 14px 10px 16px", fontSize: "13px", fontFamily: sans,
      boxShadow: "0 6px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: "12px",
      maxWidth: "calc(100vw - 32px)", animation: "fadeIn 0.2s ease",
    }}>
      <span>↻ {message}</span>
      <button onClick={onClose} aria-label="Dismiss" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "15px", padding: 0, opacity: 0.7 }}>×</button>
    </div>
  );
}

function resetMessage(items, today) {
  return items
    .map((r) => r.completed
      ? `${r.title} reminder completed`
      : `${r.title} reminder reset — next due ${fmtShortDate(r.new_due_date, today)}`)
    .join(" · ");
}

// ── Add / edit form ─────────────────────────────────────────────────────────

function toUnitValue(days) {
  if (days >= 14 && days % 7 === 0) return { n: String(days / 7), unit: "weeks" };
  return { n: String(days || 7), unit: "days" };
}

function ReminderForm({ initial, lastDone, onSave, onCancel, saving, error }) {
  const today = localDateStr();
  const [taskType, setTaskType] = useState(initial?.task_type || "water_change");
  const [title, setTitle] = useState(initial?.title || "");
  const [repeat, setRepeat] = useState(initial ? (initial.interval_days ? "every" : "once") : "every");
  const init = toUnitValue(initial?.interval_days || TASK_TYPES[initial?.task_type || "water_change"].defaultInterval);
  const [n, setN] = useState(init.n);
  const [unit, setUnit] = useState(init.unit);
  const [dueDate, setDueDate] = useState(initial?.due_date || "");
  const [dueDirty, setDueDirty] = useState(!!initial);
  const [autoReset, setAutoReset] = useState(initial ? !!initial.auto_reset : true);

  const days = Math.max(0, Math.round(Number(n) || 0)) * (unit === "weeks" ? 7 : 1);
  const last = taskType !== "custom" ? lastDone[taskType] : null;

  // Smart default due date (until the user picks one by hand).
  const suggested = useMemo(() => {
    if (!days) return today;
    if (repeat === "once") return addDays(today, days);
    if (last) return maxDate(addDays(last, days), today);
    return addDays(today, days);
  }, [days, repeat, last, today]);
  useEffect(() => { if (!dueDirty) setDueDate(suggested); }, [suggested, dueDirty]);

  function pickType(t) {
    setTaskType(t);
    if (!initial) {
      const u = toUnitValue(TASK_TYPES[t].defaultInterval);
      setN(u.n); setUnit(u.unit);
      setAutoReset(t !== "custom");
    }
  }

  const tooLong = days > 365;
  const valid = days >= 1 && !tooLong && dueDate && (taskType !== "custom" || title.trim());
  const meta = TASK_TYPES[taskType];

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    onSave({
      task_type: taskType,
      title: taskType === "custom" ? title.trim() : null,
      interval_days: repeat === "every" ? days : null,
      due_date: dueDate,
      auto_reset: taskType !== "custom" && autoReset,
    });
  }

  const label = (text) => <span style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: sans }}>{text}</span>;

  return (
    <form onSubmit={submit} data-testid="reminder-form" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "10px", margin: "10px 0", display: "flex", flexDirection: "column", gap: "9px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {TASK_TYPE_KEYS.map((t) => (
          <button key={t} type="button" onClick={() => pickType(t)} aria-pressed={taskType === t} style={{
            ...smallBtn, padding: "2px 7px",
            background: taskType === t ? "var(--color-accent)" : "transparent",
            borderColor: taskType === t ? "var(--color-accent)" : "var(--color-border)",
            color: taskType === t ? "#fff" : "var(--color-text-muted)",
          }}>{TASK_TYPES[t].label}</button>
        ))}
      </div>

      {taskType === "custom" && (
        <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {label("Title *")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Replace CO₂ cylinder" style={inputStyle} autoFocus />
        </label>
      )}

      <div style={{ display: "flex", gap: "4px" }} role="group" aria-label="Repeat">
        {[["every", "Every"], ["once", "Once"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setRepeat(k)} aria-pressed={repeat === k} style={{
            ...smallBtn, flex: 1,
            background: repeat === k ? "var(--color-filter-active-bg)" : "transparent",
            color: repeat === k ? "var(--color-filter-active-text)" : "var(--color-text-muted)",
            borderColor: repeat === k ? "var(--color-filter-active-border)" : "var(--color-border)",
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "3px", width: "56px" }}>
          {label(repeat === "every" ? "Every" : "In")}
          <input type="number" min="1" max={unit === "weeks" ? 52 : 365} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} style={inputStyle} aria-label={repeat === "every" ? "Every" : "In"} />
        </label>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ ...inputStyle, flex: 1 }} aria-label="Unit">
          <option value="days">days</option>
          <option value="weeks">weeks</option>
        </select>
      </div>
      {tooLong && <div style={{ fontSize: "11px", color: "var(--color-error-text)", fontFamily: sans }}>Max 365 days.</div>}

      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {label(repeat === "every" ? "First due" : "Due")}
        <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueDirty(true); }} style={inputStyle} aria-label="Due date" />
        {!dueDirty && repeat === "every" && last && (
          <span style={{ fontSize: "10px", color: "var(--color-text-subtle)", fontFamily: sans }}>
            Based on your {meta.lastLabel.replace(/^Last /, "last ")} ({fmtShortDate(last, today)})
          </span>
        )}
      </label>

      {taskType !== "custom" && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "11px", color: "var(--color-text-body)", fontFamily: sans, cursor: "pointer", lineHeight: 1.4 }}>
          <input type="checkbox" checked={autoReset} onChange={(e) => setAutoReset(e.target.checked)} style={{ accentColor: "#0891b2", marginTop: "1px" }} />
          Reset when I log {meta.entryHint}
        </label>
      )}

      {error && <div style={{ fontSize: "11px", color: "var(--color-error-text)", fontFamily: sans }}>{error}</div>}

      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={smallBtn}>Cancel</button>
        <button type="submit" disabled={!valid || saving} style={{ ...smallBtn, background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "#fff", opacity: !valid || saving ? 0.5 : 1 }}>
          {saving ? "Saving…" : initial ? "Save" : "Add reminder"}
        </button>
      </div>
    </form>
  );
}

// ── Row ─────────────────────────────────────────────────────────────────────

function ReminderRow({ r, today, onDone, onSnooze, onEdit, onDelete, busy }) {
  const [mode, setMode] = useState(null); // null | "menu" | "delete"
  const paused = r.status === "paused";
  const title = reminderTitle(r);
  const sub = [
    r.interval_days ? `Every ${fmtInterval(r.interval_days)}` : "One-time",
    `due ${fmtShortDate(r.due_date, today)}`,
  ].join(" · ");
  const subTitle = r.auto_reset ? `${sub} · resets when you log it` : sub;

  return (
    <div data-testid="reminder-row" data-task={r.task_type} style={{ padding: "7px 0", borderTop: "1px solid var(--color-border-subtle)", opacity: paused ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
        {paused ? <span style={{ width: "18px", flexShrink: 0 }} /> : (
          <button type="button" className="rm-done" disabled={busy} onClick={() => onDone(r)} aria-label={`Mark ${title} done`} title="Mark done" style={{
            width: "18px", height: "18px", flexShrink: 0, borderRadius: "50%", padding: 0, cursor: "pointer",
            border: "1.5px solid var(--color-success-border)", background: "transparent",
            fontSize: "10px", lineHeight: 1, fontFamily: sans,
          }}>✓</button>
        )}
        <span style={{ flex: 1, fontSize: "13px", color: "var(--color-text-primary)", fontFamily: sans, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={title}>{title}</span>
        <DueChip dueDate={r.due_date} today={today} paused={paused} compact />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingLeft: "25px", marginTop: "1px" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: "10px", color: "var(--color-text-subtle)", fontFamily: sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={subTitle}>{sub}</span>
        <button type="button" onClick={() => setMode(mode ? null : "menu")} aria-expanded={!!mode} aria-label={`More actions for ${title}`} title="Snooze, edit or delete" style={{
          background: "none", border: "none", padding: "0 2px", cursor: "pointer", fontSize: "13px", lineHeight: 1,
          color: mode ? "var(--color-text-secondary)" : "var(--color-text-faint)", fontFamily: sans,
        }}>⋯</button>
      </div>
      {mode && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center", paddingLeft: "25px", marginTop: "6px" }}>
          {mode === "delete" ? (
            <>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: sans }}>Delete?</span>
              <button type="button" disabled={busy} onClick={() => onDelete(r)} autoFocus style={{ ...smallBtn, color: "var(--color-error-text)", borderColor: "var(--color-error-border)" }}>Delete</button>
              <button type="button" onClick={() => setMode("menu")} style={smallBtn}>Cancel</button>
            </>
          ) : (
            <>
              {!paused && <span style={{ fontSize: "10px", color: "var(--color-text-subtle)", fontFamily: sans }}>Snooze</span>}
              {!paused && [1, 3, 7].map((d) => (
                <button key={d} type="button" disabled={busy} onClick={() => { setMode(null); onSnooze(r, d); }} style={smallBtn}>{d}d</button>
              ))}
              <button type="button" onClick={() => { setMode(null); onEdit(r); }} style={smallBtn}>Edit</button>
              <button type="button" onClick={() => setMode("delete")} style={{ ...smallBtn, color: "var(--color-error-text)" }}>Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

export default function RemindersCard({ tankId, entries = [], resetEvent = null, onRemindersChange }) {
  const [reminders, setReminders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);
  const onChangeRef = useRef(onRemindersChange);
  onChangeRef.current = onRemindersChange;

  const today = localDateStr();
  const base = `/api/tanks/${tankId}/reminders`;
  const lastDone = useMemo(() => lastDoneFromEntries(entries), [entries]);

  const apply = useCallback((list) => {
    setReminders(list);
    onChangeRef.current?.(list);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      if (!res.ok) throw new Error();
      const data = await res.json();
      apply(data.reminders);
    } catch {
      setError("Couldn't load reminders.");
    } finally {
      setLoaded(true);
    }
  }, [base, apply]);

  useEffect(() => { load(); }, [load]);

  // Entry saved → server auto-reset some reminders → reload + toast.
  useEffect(() => {
    if (!resetEvent?.items?.length) return;
    load();
    setToast(resetMessage(resetEvent.items, localDateStr()));
    posthog.capture("reminder_auto_reset", { count: resetEvent.items.length, task_types: resetEvent.items.map((i) => i.task_type) });
  }, [resetEvent, load]);

  async function call(path, method, body) {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      let msg = "Something went wrong.";
      try { msg = (await res.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }

  async function save(values) {
    setSaving(true); setFormError(null);
    try {
      if (editing) {
        await call(`/api/reminders/${editing.id}`, "PATCH", values);
        posthog.capture("reminder_updated", { task_type: values.task_type, recurring: !!values.interval_days });
      } else {
        let timezone;
        try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
        await call(base, "POST", { ...values, timezone });
        posthog.capture("reminder_created", { task_type: values.task_type, recurring: !!values.interval_days, interval_days: values.interval_days, auto_reset: values.auto_reset });
      }
      setShowForm(false); setEditing(null);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function done(r) {
    setBusyId(r.id); setError(null);
    try {
      const res = await call(`/api/reminders/${r.id}/done`, "POST", { date: localDateStr() });
      posthog.capture("reminder_completed", { task_type: r.task_type, recurring: !!r.interval_days, source: "app" });
      setToast(res.completed ? `${reminderTitle(r)} done` : `${reminderTitle(r)} done — next due ${fmtShortDate(res.reminder.due_date, localDateStr())}`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  async function snoozeIt(r, days) {
    setBusyId(r.id); setError(null);
    try {
      const res = await call(`/api/reminders/${r.id}/snooze`, "POST", { days, today: localDateStr() });
      posthog.capture("reminder_snoozed", { task_type: r.task_type, days, source: "app" });
      setToast(`${reminderTitle(r)} snoozed to ${fmtShortDate(res.reminder.due_date, localDateStr())}`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  async function remove(r) {
    setBusyId(r.id); setError(null);
    try {
      await call(`/api/reminders/${r.id}`, "DELETE");
      posthog.capture("reminder_deleted", { task_type: r.task_type });
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  const formOpen = showForm || !!editing;

  return (
    <div data-testid="reminders-card" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "12px", padding: "14px 18px", marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ fontFamily: "'Lora', serif", fontSize: "15px", color: "var(--color-text-primary)", fontWeight: 400 }}>Reminders</div>
        {!formOpen && (
          <button type="button" onClick={() => { setShowForm(true); setEditing(null); setFormError(null); }} style={{ ...smallBtn, fontSize: "11px" }}>+ Add reminder</button>
        )}
      </div>

      {formOpen && (
        <ReminderForm
          key={editing?.id ?? "new"}
          initial={editing}
          lastDone={lastDone}
          saving={saving}
          error={formError}
          onSave={save}
          onCancel={() => { setShowForm(false); setEditing(null); setFormError(null); }}
        />
      )}

      {error && <div style={{ fontSize: "11px", color: "var(--color-error-text)", fontFamily: sans, marginTop: "6px" }}>{error}</div>}

      <div style={{ marginTop: "8px" }}>
        {reminders.map((r) => (
          <ReminderRow key={r.id} r={r} today={today} busy={busyId === r.id}
            onDone={done} onSnooze={snoozeIt} onDelete={remove}
            onEdit={(x) => { setEditing(x); setShowForm(false); setFormError(null); }} />
        ))}
        {loaded && reminders.length === 0 && !formOpen && (
          <div style={{ fontSize: "11px", color: "var(--color-text-faint)", fontFamily: sans, padding: "6px 0 2px", lineHeight: 1.5 }}>
            No reminders yet — e.g. a water change every 6 weeks.
          </div>
        )}
      </div>

      <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--color-border-subtle)", fontSize: "10px", color: "var(--color-text-faint)", fontFamily: sans, lineHeight: 1.5 }}>
        Private to you. <Link href="/account/notifications" style={{ color: "var(--color-text-subtle)" }}>Email settings</Link>
      </div>

      <style>{`
        .rm-done { color: transparent; }
        .rm-done:hover, .rm-done:focus-visible { color: var(--color-success-text); background: var(--color-success-bg) !important; opacity: 1 !important; }
      `}</style>
      <Toast message={toast} onClose={closeToast} />
    </div>
  );
}
