"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";
import {
  accentBtnStyle,
  sansFamily,
  serifFamily,
  settingsInputStyle as inputStyle,
} from "@/components/formStyles";
import DeleteAccount from "./DeleteAccount";
import { Field, Section, Status } from "./ui";

const USERNAME_PATTERN = "[a-zA-Z0-9_\\-]+";

/** Small helper for "submit → error | success" section forms. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function run(url, { method = "POST", body }, onOk) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 401 && data.error === "Unauthorized"
            ? "Your session has expired. Please sign in again."
            : data.error || "Something went wrong. Please try again."
        );
        return;
      }
      setSuccess((await onOk?.(data)) || "Saved.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, success, run, clear: () => { setError(""); setSuccess(""); } };
}

function SubmitRow({ busy, label, busyLabel = "Saving…", disabled }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button type="submit" disabled={busy || disabled} style={{ ...accentBtnStyle, opacity: busy || disabled ? 0.6 : 1 }}>
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

const formStyle = { display: "flex", flexDirection: "column", gap: "14px" };

// ── Profile ──────────────────────────────────────────────────────────────────

function ProfileSection({ user, tanks }) {
  const router = useRouter();
  const [savedUsername, setSavedUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [username, setUsername] = useState(user.username);
  const action = useAction();

  const nextUsername = username.trim().toLowerCase();
  const usernameChanging = nextUsername !== savedUsername && nextUsername !== "";
  const publicTanks = tanks.filter((t) => t.is_public && t.slug);

  function submit(e) {
    e.preventDefault();
    action.run("/api/account/profile", { method: "PATCH", body: { display_name: displayName, username } }, (data) => {
      posthog.capture("profile_updated", { username_changed: data.username !== savedUsername });
      setSavedUsername(data.username);
      setUsername(data.username);
      setDisplayName(data.display_name || "");
      router.refresh(); // update the name in the Nav
      return "Profile saved.";
    });
  }

  return (
    <Section id="profile" title="Profile" description="How you appear in AquaSlog and on your public tank pages.">
      <form onSubmit={submit} style={formStyle}>
        <Field label="Display name">
          <input
            type="text"
            value={displayName}
            maxLength={80}
            placeholder={savedUsername}
            onChange={(e) => { action.clear(); setDisplayName(e.target.value); }}
            style={inputStyle}
          />
        </Field>
        <Field label="Username" hint={`Letters, numbers, hyphens and underscores. Public tanks live at /t/${nextUsername || savedUsername}/…`}>
          <input
            type="text"
            value={username}
            required
            pattern={USERNAME_PATTERN}
            title="Letters, numbers, hyphens, and underscores only"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => { action.clear(); setUsername(e.target.value); }}
            style={inputStyle}
          />
        </Field>
        {usernameChanging && (
          <div role="note" style={{
            background: "var(--color-warning-bg)", border: "1px solid var(--color-warning-border)",
            borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "var(--color-warning-text)", lineHeight: 1.55,
          }}>
            <strong style={{ fontWeight: 500 }}>Changing your username changes your public tank URLs.</strong>{" "}
            Old links will stop working.
            {publicTanks.length > 0 && (
              <ul style={{ margin: "6px 0 0", paddingLeft: "18px", wordBreak: "break-all" }}>
                {publicTanks.map((t) => (
                  <li key={t.id}>/t/{savedUsername}/{t.slug} → /t/{nextUsername}/{t.slug}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <Status error={action.error} success={action.success} />
        <SubmitRow busy={action.busy} label="Save profile" />
      </form>
    </Section>
  );
}

// ── Email ────────────────────────────────────────────────────────────────────

function EmailSection({ user }) {
  const router = useRouter();
  const [currentEmail, setCurrentEmail] = useState(user.email);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const action = useAction();

  function submit(e) {
    e.preventDefault();
    action.run("/api/account/email", { body: { email, current_password: password } }, (data) => {
      posthog.capture("email_changed");
      setCurrentEmail(data.email);
      setEmail("");
      setPassword("");
      router.refresh();
      return "Email updated. Use it the next time you sign in.";
    });
  }

  return (
    <Section id="email" title="Email" description={<>You sign in with <strong style={{ fontWeight: 500, color: "var(--color-text-secondary)", wordBreak: "break-all" }}>{currentEmail}</strong>. Password-reset emails go here.</>}>
      <form onSubmit={submit} style={formStyle}>
        <Field label="New email">
          <input type="email" value={email} required autoComplete="email"
            onChange={(e) => { action.clear(); setEmail(e.target.value); }} style={inputStyle} />
        </Field>
        <Field label="Current password">
          <input type="password" value={password} required autoComplete="current-password"
            onChange={(e) => { action.clear(); setPassword(e.target.value); }} style={inputStyle} />
        </Field>
        <Status error={action.error} success={action.success} />
        <SubmitRow busy={action.busy} label="Change email" />
      </form>
    </Section>
  );
}

// ── Password ─────────────────────────────────────────────────────────────────

function PasswordSection({ user }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const action = useAction();
  const mismatch = confirm.length > 0 && next !== confirm;

  function submit(e) {
    e.preventDefault();
    if (mismatch) return;
    action.run("/api/account/password", { body: { current_password: current, new_password: next } }, (data) => {
      posthog.capture("password_changed");
      setCurrent("");
      setNext("");
      setConfirm("");
      const n = data.other_sessions_signed_out || 0;
      return n > 0
        ? `Password changed. Signed out ${n} other session${n === 1 ? "" : "s"}.`
        : "Password changed. Any other sessions have been signed out.";
    });
  }

  return (
    <Section id="password" title="Password" description="Changing your password signs you out everywhere else.">
      <form onSubmit={submit} style={formStyle}>
        {/* Hidden username helps password managers save the right entry. */}
        <input type="text" name="username" autoComplete="username" value={user.email} hidden readOnly />
        <Field label="Current password">
          <input type="password" value={current} required autoComplete="current-password"
            onChange={(e) => { action.clear(); setCurrent(e.target.value); }} style={inputStyle} />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input type="password" value={next} required minLength={8} autoComplete="new-password"
            onChange={(e) => { action.clear(); setNext(e.target.value); }} style={inputStyle} />
        </Field>
        <Field label="Confirm new password">
          <input type="password" value={confirm} required minLength={8} autoComplete="new-password"
            onChange={(e) => { action.clear(); setConfirm(e.target.value); }} style={inputStyle} />
        </Field>
        <Status error={action.error || (mismatch ? "New passwords don't match." : "")} success={action.success} />
        <SubmitRow busy={action.busy} label="Change password" disabled={mismatch} />
      </form>
    </Section>
  );
}

// ── Notifications (page owned by the reminders feature) ──────────────────────

function NotificationsSection() {
  return (
    <Section id="notifications" title="Notifications">
      <Link href="/account/notifications" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
        border: "1px solid var(--color-border-faint)", borderRadius: "10px", padding: "14px 16px",
        textDecoration: "none", background: "var(--color-bg)",
      }}>
        <span>
          <span style={{ display: "block", fontSize: "14px", color: "var(--color-text-primary)" }}>Email &amp; calendar</span>
          <span style={{ display: "block", fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>Reminder emails and your private calendar link.</span>
        </span>
        <span aria-hidden style={{ color: "var(--color-accent)", fontSize: "16px" }}>→</span>
      </Link>
    </Section>
  );
}

// ── Your data ────────────────────────────────────────────────────────────────

const linkStyle = { color: "var(--color-accent)", textDecoration: "none" };

function DataSection({ tanks }) {
  return (
    <Section
      id="your-data"
      title="Your data"
      description="Download a copy of everything you've logged. Your password is never included."
    >
      <a
        href="/api/account/export?format=json"
        download
        onClick={() => posthog.capture("data_exported", { format: "json" })}
        style={{ ...accentBtnStyle, display: "inline-block", textDecoration: "none" }}
      >
        Download all data (JSON)
      </a>
      <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "8px 0 0" }}>
        Profile, tanks, journal entries and inhabitants in one file.
      </p>

      {tanks.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "0 0 8px", fontWeight: 500 }}>
            Journal entries as CSV (opens in Excel, Numbers or Google Sheets)
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
            {tanks.map((t) => (
              <li key={t.id} style={{ fontSize: "13px", color: "var(--color-text-body)", display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
                <a
                  href={`/api/account/export?format=csv&tank=${t.id}`}
                  download
                  onClick={() => posthog.capture("data_exported", { format: "csv", source: "account" })}
                  style={linkStyle}
                >
                  {t.name}.csv
                </a>
                <span style={{ color: "var(--color-text-subtle)", fontSize: "12px" }}>
                  {t.entry_count} {t.entry_count === 1 ? "entry" : "entries"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AccountSettings({ user, tanks }) {
  const joined = user.created_at ? new Date(user.created_at.replace(" ", "T") + "Z") : null;
  return (
    <div style={{ maxWidth: "560px", width: "100%", margin: "0 auto", padding: "40px 16px 80px", fontFamily: sansFamily }}>
      <Link href="/dashboard" style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none", display: "block", marginBottom: "24px" }}>
        ← My tanks
      </Link>
      <h1 style={{ fontFamily: serifFamily, fontSize: "26px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
        Account
      </h1>
      <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 20px" }}>
        @{user.username}
        {joined && !isNaN(joined) && <> · member since {joined.toLocaleDateString(undefined, { year: "numeric", month: "long" })}</>}
      </p>

      <ProfileSection user={user} tanks={tanks} />
      <EmailSection user={user} />
      <PasswordSection user={user} />
      <NotificationsSection />
      <DataSection tanks={tanks} />
      <DeleteAccount username={user.username} tanks={tanks} />
    </div>
  );
}
