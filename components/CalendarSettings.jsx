"use client";

/**
 * "Calendar" section of /account/notifications: the user's private ICS subscription
 * link (/cal/<token>.ics — see lib/calendar/feed.js).
 *
 *   <CalendarSettings initial={{ urls: { https, webcal, google } } | null} unavailable? />
 *
 * The link is created on demand ("Create calendar link") rather than on first view, so
 * no secret URL exists until the user asks for one.
 */

import { useState } from "react";
import posthog from "posthog-js";

const sans = "'DM Sans', sans-serif";
const serif = "'Lora', serif";

const btn = {
  background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)",
  borderRadius: "7px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", fontFamily: sans,
  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", lineHeight: 1.3,
  whiteSpace: "nowrap",
};
const primaryBtn = { ...btn, background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "#fff", fontWeight: 500 };
const note = { fontSize: "12px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.6 };

export default function CalendarSettings({ initial, unavailable = false }) {
  const [urls, setUrls] = useState(initial?.urls ?? null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [status, setStatus] = useState(null); // { kind: "ok"|"error", text }

  async function post(path) {
    const res = await fetch(path, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  async function create() {
    setBusy(true); setStatus(null);
    try {
      const data = await post("/api/calendar");
      setUrls(data.urls);
      if (data.created) posthog.capture("calendar_link_created");
    } catch (e) {
      setStatus({ kind: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true); setStatus(null);
    try {
      const data = await post("/api/calendar/reset");
      setUrls(data.urls);
      setConfirmReset(false);
      posthog.capture("calendar_link_reset");
      setStatus({ kind: "ok", text: "New link created. The old link no longer works — re-subscribe with this one." });
    } catch (e) {
      setStatus({ kind: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(urls.https);
    } catch {
      // Clipboard API blocked (e.g. insecure context): select the text so ⌘C / Ctrl+C works.
      const el = document.getElementById("calendar-url");
      el?.focus(); el?.select();
      setStatus({ kind: "ok", text: "Press ⌘C / Ctrl+C to copy." });
      return;
    }
    posthog.capture("calendar_link_copied");
    setStatus({ kind: "ok", text: "Link copied." });
  }

  return (
    <section id="calendar" aria-labelledby="calendar-h" data-testid="calendar-settings" style={{ marginTop: "40px", fontFamily: sans }}>
      <h2 id="calendar-h" style={{ fontFamily: serif, fontSize: "20px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>Calendar</h2>
      <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 18px", lineHeight: 1.6 }}>
        Subscribe in your calendar app to see each reminder on its next due date. When you log the task,
        the event moves to the new date.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "12px", padding: "22px" }}>
        {unavailable ? (
          <p style={note}>Calendar links are unavailable right now. Please try again later.</p>
        ) : !urls ? (
          <>
            <p style={{ ...note, color: "var(--color-text-body)", fontSize: "13px" }}>
              Works with Apple Calendar, Google Calendar, Outlook and any app that can subscribe to an iCal (.ics) link.
            </p>
            <div>
              <button type="button" onClick={create} disabled={busy} data-testid="calendar-create" style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
                {busy ? "Creating…" : "Create calendar link"}
              </button>
            </div>
            <p style={note}>The link is private: anyone who has it can see your reminder titles and tank names. You can reset it any time.</p>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="calendar-url" style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "block", marginBottom: "5px" }}>Your private calendar link</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="calendar-url" data-testid="calendar-url" readOnly value={urls.https}
                  onFocus={(e) => e.target.select()}
                  style={{
                    flex: 1, minWidth: 0, padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: "6px",
                    fontSize: "12px", background: "var(--color-input-bg)", color: "var(--color-input-text)",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", outline: "none", boxSizing: "border-box",
                  }}
                />
                <button type="button" onClick={copy} data-testid="calendar-copy" style={btn}>Copy</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <a href={urls.webcal} data-testid="calendar-webcal" style={primaryBtn}>Subscribe in Apple Calendar</a>
              <a href={urls.google} target="_blank" rel="noopener noreferrer" data-testid="calendar-google" style={btn}>Add to Google Calendar ↗</a>
            </div>

            <p style={note}>
              Outlook and others: choose “Subscribe from web” (or “From URL”) and paste the link.
              Google Calendar refreshes subscribed calendars only every 8–24 hours, so a moved reminder can take
              up to a day to show there. Apple Calendar is faster — on a Mac, pick an Auto-refresh of “Every hour”.
            </p>
            <p style={note}>
              Anyone with this link can see your reminder titles and tank names. If it ends up somewhere it
              shouldn’t, reset it: the old link stops working immediately.
            </p>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "14px" }}>
              {confirmReset ? (
                <>
                  <span style={{ fontSize: "13px", color: "var(--color-text-body)" }}>Reset the link? Calendars using the current one will stop updating.</span>
                  <button type="button" onClick={reset} disabled={busy} autoFocus data-testid="calendar-reset-confirm" style={{ ...btn, color: "var(--color-danger-btn-text)", borderColor: "var(--color-danger-btn-border)", opacity: busy ? 0.6 : 1 }}>
                    {busy ? "Resetting…" : "Reset link"}
                  </button>
                  <button type="button" onClick={() => setConfirmReset(false)} style={btn}>Cancel</button>
                </>
              ) : (
                <button type="button" onClick={() => { setConfirmReset(true); setStatus(null); }} data-testid="calendar-reset" style={btn}>Reset link</button>
              )}
            </div>
          </>
        )}
        {status && (
          <span role="status" style={{ fontSize: "12px", color: status.kind === "ok" ? "var(--color-success-text)" : "var(--color-error-text)" }}>{status.text}</span>
        )}
      </div>
    </section>
  );
}
