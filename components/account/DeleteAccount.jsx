"use client";

import { useRef, useState, useEffect } from "react";
import posthog from "posthog-js";
import { dangerBtnStyle, sansFamily, settingsInputStyle as inputStyle } from "@/components/formStyles";
import { resetAnalytics } from "@/lib/analytics";
import { Field, Section, Status } from "./ui";

/**
 * Danger zone: inline (no window.confirm) two-factor confirmation —
 * type the username + current password.
 */
export default function DeleteAccount({ username, tanks }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstInput = useRef(null);

  useEffect(() => {
    if (open) firstInput.current?.focus();
  }, [open]);

  const entryCount = tanks.reduce((n, t) => n + (t.entry_count || 0), 0);
  const matches = typed.trim().toLowerCase() === username;

  function cancel() {
    setOpen(false);
    setTyped("");
    setPassword("");
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: typed, current_password: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not delete your account. Please try again.");
        setBusy(false);
        return;
      }
      posthog.capture("account_deleted");
      resetAnalytics();
      // Full navigation: drops all client state for the deleted account.
      window.location.assign("/goodbye");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Section id="delete-account" title="Delete account" tone="danger">
      {!open ? (
        <>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 14px", lineHeight: 1.55 }}>
            Permanently delete your account, all of your tanks, journal entries and inhabitants, and
            take down your public tank pages. This can't be undone — download your data first if you
            want a copy.
          </p>
          <button type="button" onClick={() => setOpen(true)} style={dangerBtnStyle}>
            Delete my account…
          </button>
        </>
      ) : (
        <form
          onSubmit={submit}
          aria-label="Confirm account deletion"
          style={{
            display: "flex", flexDirection: "column", gap: "14px",
            border: "1px solid var(--color-error-border)", background: "var(--color-error-bg)",
            borderRadius: "10px", padding: "16px",
          }}
        >
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.55 }}>
            This will immediately and permanently delete <strong style={{ fontWeight: 500 }}>@{username}</strong>
            {tanks.length > 0 && (
              <>, {tanks.length} tank{tanks.length === 1 ? "" : "s"} and {entryCount} journal entr{entryCount === 1 ? "y" : "ies"}</>
            )}
            , and sign you out on every device.
          </p>
          <Field label={<>Type <strong style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>{username}</strong> to confirm</>}>
            <input
              ref={firstInput}
              type="text"
              value={typed}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => { setError(""); setTyped(e.target.value); }}
              style={inputStyle}
            />
          </Field>
          <Field label="Current password">
            <input
              type="password"
              value={password}
              required
              autoComplete="current-password"
              onChange={(e) => { setError(""); setPassword(e.target.value); }}
              style={inputStyle}
            />
          </Field>
          <Status error={error} />
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" onClick={cancel} disabled={busy} style={{
              fontSize: "13px", color: "var(--color-text-muted)", background: "none", border: "1px solid var(--color-border)",
              borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontFamily: sansFamily,
            }}>
              Cancel
            </button>
            <button type="submit" disabled={!matches || !password || busy} style={{
              fontSize: "13px", fontWeight: 500, color: "#fff", background: "#dc2626", border: "none",
              borderRadius: "6px", padding: "8px 16px", cursor: !matches || !password || busy ? "default" : "pointer",
              opacity: !matches || !password || busy ? 0.5 : 1, fontFamily: sansFamily,
            }}>
              {busy ? "Deleting…" : "Permanently delete account"}
            </button>
          </div>
        </form>
      )}
    </Section>
  );
}
