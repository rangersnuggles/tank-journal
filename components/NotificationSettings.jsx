"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import posthog from "posthog-js";

const sans = "'DM Sans', sans-serif";
const serif = "'Lora', serif";

const inputStyle = {
  padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: "6px",
  fontSize: "14px", background: "var(--color-input-bg)", color: "var(--color-input-text)",
  outline: "none", boxSizing: "border-box", fontFamily: sans,
};

function hourLabel(h) {
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

export default function NotificationSettings({ initial, email, children }) {
  const [enabled, setEnabled] = useState(!!initial.reminders_email);
  const [hour, setHour] = useState(initial.digest_hour);
  // No saved settings yet → prefill the browser's timezone.
  const [timezone, setTimezone] = useState(initial.has_row ? initial.timezone : "UTC");
  const [unsubscribedAt, setUnsubscribedAt] = useState(initial.unsubscribed_at);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { kind: "ok"|"error", text }
  const [testing, setTesting] = useState(false);

  useEffect(() => { if (!initial.has_row) setTimezone(browserTimeZone()); }, [initial.has_row]);

  const zones = useMemo(() => {
    let list = [];
    try { list = Intl.supportedValuesOf("timeZone"); } catch {}
    if (!list.includes("UTC")) list = ["UTC", ...list];
    if (timezone && !list.includes(timezone)) list = [timezone, ...list];
    return list;
  }, [timezone]);

  async function save(e) {
    e.preventDefault();
    setSaving(true); setStatus(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminders_email: enabled, digest_hour: Number(hour), timezone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setUnsubscribedAt(data.unsubscribed_at);
      posthog.capture("notification_prefs_updated", { reminders_email: enabled, digest_hour: Number(hour) });
      setStatus({ kind: "ok", text: "Saved." });
    } catch (err) {
      setStatus({ kind: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true); setStatus(null);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      setStatus({ kind: "ok", text: data.mode === "log" ? "Test email captured to the local outbox (/dev/outbox)." : `Test email sent to ${email}.` });
    } catch (err) {
      setStatus({ kind: "error", text: err.message });
    } finally {
      setTesting(false);
    }
  }

  const label = { fontSize: "12px", color: "var(--color-text-muted)", fontFamily: sans, display: "block", marginBottom: "5px" };

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "48px 24px 80px", fontFamily: sans }}>
      <Link href="/dashboard" style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none" }}>← Dashboard</Link>
      <h1 style={{ fontFamily: serif, fontSize: "26px", fontWeight: 400, color: "var(--color-text-primary)", margin: "16px 0 4px", letterSpacing: "-0.02em" }}>Email &amp; calendar</h1>
      <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 28px", lineHeight: 1.6 }}>
        One email a day at most, only when a reminder is due — grouped by tank, with Done and Snooze links.
        Overdue reminders are re-sent after 3 and 6 days, then we stop emailing about them.
      </p>

      {unsubscribedAt && !enabled && (
        <div data-testid="unsubscribed-note" style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info-border)", color: "var(--color-info-text)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "20px" }}>
          You unsubscribed from reminder emails. Turn them back on below any time.
        </div>
      )}

      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: "22px", background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "12px", padding: "22px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "var(--color-text-primary)", cursor: "pointer" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#0891b2" }} />
          Email me when reminders are due
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", opacity: enabled ? 1 : 0.5 }}>
          <label>
            <span style={label}>Send after</span>
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))} disabled={!enabled} style={{ ...inputStyle, width: "100%" }}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label>
            <span style={label}>Timezone</span>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!enabled} data-testid="tz-select" style={{ ...inputStyle, width: "100%" }}>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </label>
        </div>
        <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "-8px 0 0", lineHeight: 1.5 }}>
          Sent to {email}. Due dates use this timezone’s calendar day.
        </p>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={saving} style={{ background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: "7px", padding: "8px 18px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: sans, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={sendTest} disabled={testing} style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", borderRadius: "7px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", fontFamily: sans }}>
            {testing ? "Sending…" : "Send test email"}
          </button>
          {status && (
            <span role="status" style={{ fontSize: "12px", color: status.kind === "ok" ? "var(--color-success-text)" : "var(--color-error-text)" }}>{status.text}</span>
          )}
        </div>
      </form>

      {children}
    </div>
  );
}
