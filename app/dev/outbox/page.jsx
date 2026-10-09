export const runtime = "edge";
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getDB } from "@/lib/db";

// Dev-only: review emails captured by lib/email/send.js in log mode.
// 404s unless running under `next dev`.

const sans = "'DM Sans', sans-serif";

export default async function DevOutboxPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  let rows = [];
  let loadError = null;
  try {
    const { results } = await getDB()
      .prepare(`SELECT * FROM email_outbox ORDER BY id DESC LIMIT 50`)
      .all();
    rows = results;
  } catch (err) {
    loadError = err?.message || String(err);
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px", fontFamily: sans, color: "var(--color-text-primary)" }}>
      <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 400, fontSize: "24px", margin: "0 0 4px" }}>Dev outbox</h1>
      <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 28px" }}>
        Emails captured locally (EMAIL_MODE=log or no RESEND_API_KEY). Nothing here was sent. Newest first, last 50.
      </p>

      {loadError && (
        <p style={{ fontSize: "13px", color: "var(--color-error-text)" }}>
          Could not read email_outbox: {loadError}. Run <code>npm run db:migrate:local</code>.
        </p>
      )}
      {!loadError && rows.length === 0 && (
        <p style={{ fontSize: "13px", color: "var(--color-text-subtle)" }}>No captured emails yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {rows.map((m) => {
          let headers = {};
          try { headers = JSON.parse(m.headers || "{}"); } catch {}
          return (
            <section key={m.id} data-testid="outbox-email" style={{ border: "1px solid var(--color-border)", borderRadius: "10px", overflow: "hidden", background: "var(--color-surface)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-border-subtle)", fontSize: "13px", display: "grid", gridTemplateColumns: "90px 1fr", rowGap: "4px" }}>
                <span style={{ color: "var(--color-text-subtle)" }}>#</span><span>{m.id} · {m.created_at} UTC</span>
                <span style={{ color: "var(--color-text-subtle)" }}>To</span><span>{m.to_addr}</span>
                <span style={{ color: "var(--color-text-subtle)" }}>From</span><span>{m.from_addr}</span>
                <span style={{ color: "var(--color-text-subtle)" }}>Subject</span><strong style={{ fontWeight: 600 }}>{m.subject}</strong>
                {m.idempotency_key && (<><span style={{ color: "var(--color-text-subtle)" }}>Idem key</span><code style={{ fontSize: "12px" }}>{m.idempotency_key}</code></>)}
                {Object.keys(headers).length > 0 && (
                  <><span style={{ color: "var(--color-text-subtle)" }}>Headers</span><code style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{JSON.stringify(headers, null, 2)}</code></>
                )}
              </div>
              {m.html && (
                <iframe
                  title={`Email ${m.id} HTML`}
                  srcDoc={m.html}
                  sandbox=""
                  style={{ width: "100%", height: "380px", border: "none", background: "#fff", display: "block" }}
                />
              )}
              {m.text && (
                <details style={{ padding: "10px 18px", borderTop: "1px solid var(--color-border-subtle)", fontSize: "12px" }}>
                  <summary style={{ cursor: "pointer", color: "var(--color-text-muted)" }}>Plain-text version</summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", margin: "10px 0 0" }}>{m.text}</pre>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
