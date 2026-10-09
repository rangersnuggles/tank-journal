/**
 * Single entry point for outgoing email.
 *
 *   await sendEmail(env, { to, subject, html, text, headers, idempotencyKey })
 *
 * Modes:
 *   - "log"    — EMAIL_MODE=log, or no RESEND_API_KEY configured. Nothing leaves
 *                the machine: the message is written to the `email_outbox` D1
 *                table (migration 0002) and is viewable at /dev/outbox in dev.
 *   - "resend" — POST to the Resend API. Non-2xx responses throw EmailError.
 *
 * `env` is the Cloudflare env (getRequestContext().env). Config is read from env
 * first, then process.env (next dev loads .env.local into process.env).
 */

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "AquaSlog <noreply@aquaslog.com>";

export class EmailError extends Error {
  constructor(message, { status, body, mode } = {}) {
    super(message);
    this.name = "EmailError";
    this.status = status;
    this.body = body;
    this.mode = mode;
  }
}

function config(env, key) {
  const v = env?.[key] ?? (typeof process !== "undefined" ? process.env?.[key] : undefined);
  return typeof v === "string" ? v.trim() : v;
}

export function emailMode(env) {
  if ((config(env, "EMAIL_MODE") || "").toLowerCase() === "log") return "log";
  if (!config(env, "RESEND_API_KEY")) return "log";
  return "resend";
}

/**
 * @param {object} env  Cloudflare env with a DB binding (needed for log mode)
 * @param {object} msg
 * @param {string|string[]} msg.to
 * @param {string} msg.subject
 * @param {string} [msg.html]
 * @param {string} [msg.text]
 * @param {Record<string,string>} [msg.headers]  extra email headers (e.g. List-Unsubscribe)
 * @param {string} [msg.idempotencyKey]  dedupes retries (Resend Idempotency-Key / unique in outbox)
 * @param {string} [msg.from]
 * @returns {Promise<{ mode: "log"|"resend", id: string|number|null, duplicate?: boolean }>}
 */
export async function sendEmail(env, { to, subject, html, text, headers, idempotencyKey, from } = {}) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) throw new EmailError("sendEmail: `to` is required");
  if (!subject) throw new EmailError("sendEmail: `subject` is required");
  if (!html && !text) throw new EmailError("sendEmail: `html` or `text` is required");

  const fromAddr = from || config(env, "EMAIL_FROM") || DEFAULT_FROM;
  const mode = emailMode(env);

  if (mode === "log") {
    if (config(env, "EMAIL_MODE")?.toLowerCase() !== "log") {
      console.warn("sendEmail: RESEND_API_KEY not set — capturing email to email_outbox instead of sending");
    }
    const db = env?.DB;
    if (!db) throw new EmailError("sendEmail (log mode): no DB binding available", { mode });
    try {
      const { meta } = await db
        .prepare(
          `INSERT INTO email_outbox (to_addr, from_addr, subject, html, text, headers, idempotency_key)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          recipients.join(", "),
          fromAddr,
          subject,
          html ?? null,
          text ?? null,
          JSON.stringify(headers ?? {}),
          idempotencyKey ?? null
        )
        .run();
      return { mode, id: meta?.last_row_id ?? null };
    } catch (err) {
      if (idempotencyKey && String(err?.message).includes("UNIQUE")) {
        return { mode, id: null, duplicate: true };
      }
      throw new EmailError(`sendEmail (log mode): could not write to email_outbox: ${err?.message}`, { mode });
    }
  }

  const reqHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config(env, "RESEND_API_KEY")}`,
  };
  if (idempotencyKey) reqHeaders["Idempotency-Key"] = idempotencyKey;

  const payload = { from: fromAddr, to: recipients, subject };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (headers && Object.keys(headers).length) payload.headers = headers;

  let res;
  try {
    res = await fetch(RESEND_URL, { method: "POST", headers: reqHeaders, body: JSON.stringify(payload) });
  } catch (err) {
    throw new EmailError(`sendEmail: network error calling Resend: ${err?.message}`, { mode });
  }

  const raw = await res.text();
  let body;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }

  if (!res.ok) {
    const detail = (body && typeof body === "object" && (body.message || body.error)) || raw || res.statusText;
    throw new EmailError(`sendEmail: Resend responded ${res.status}: ${detail}`, { status: res.status, body, mode });
  }

  return { mode, id: body?.id ?? null };
}
