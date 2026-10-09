"use client";

// Dev-only control on /dev/outbox: run the reminder digest now (POST /api/dev/reminders/digest).

import { useState } from "react";
import { useRouter } from "next/navigation";

const sans = "'DM Sans', sans-serif";

export default function DevDigestButton() {
  const router = useRouter();
  const [ignoreHour, setIgnoreHour] = useState(true);
  const [resetToday, setResetToday] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);

  async function run() {
    setBusy(true); setSummary(null);
    try {
      const res = await fetch("/api/dev/reminders/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignoreHour, resetToday }),
      });
      setSummary(res.ok ? await res.json() : { error: await res.text() });
      router.refresh();
    } catch (e) {
      setSummary({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  const check = { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--color-text-body)", cursor: "pointer" };
  return (
    <div data-testid="dev-digest" style={{ border: "1px dashed var(--color-border)", borderRadius: "10px", padding: "12px 16px", margin: "0 0 24px", fontFamily: sans, display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <button type="button" onClick={run} disabled={busy} data-testid="run-digest" style={{ background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: "6px", padding: "7px 14px", fontSize: "13px", cursor: "pointer", fontFamily: sans }}>
          {busy ? "Running…" : "Run reminder digest now"}
        </button>
        <label style={check}><input type="checkbox" checked={ignoreHour} onChange={(e) => setIgnoreHour(e.target.checked)} data-testid="ignore-hour" /> Ignore digest hour</label>
        <label style={check}><input type="checkbox" checked={resetToday} onChange={(e) => setResetToday(e.target.checked)} data-testid="reset-today" /> Forget today’s digests (re-send)</label>
      </div>
      {summary && (
        <pre data-testid="digest-summary" style={{ margin: 0, fontSize: "11px", whiteSpace: "pre-wrap", color: "var(--color-text-muted)", maxHeight: "160px", overflow: "auto" }}>
          {summary.error ? `Error: ${summary.error}` : `sent ${summary.sent} · already sent today ${summary.already_claimed} · nothing due ${summary.nothing_due} · before digest hour ${summary.skipped_hour} · failed ${summary.failed}\n` + summary.users.map((u) => `  user ${u.user_id} ${u.timezone} ${u.local_date} ${String(u.local_hour).padStart(2, "0")}h → ${u.result}${u.items ? ` (${u.items})` : ""}${u.error ? `: ${u.error}` : ""}`).join("\n")}
        </pre>
      )}
    </div>
  );
}
