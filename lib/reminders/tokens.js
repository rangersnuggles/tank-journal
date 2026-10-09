/**
 * Signed links for reminder emails (HMAC-SHA256 via crypto.subtle — edge/Worker safe).
 *
 * Token = base64url(JSON payload) + "." + base64url(HMAC(payload)).
 * Payload: { a: action, rid: reminderId|null, uid: userId, due: dueDate|null, exp: unixSeconds }
 *   a = "done" | "snooze"  → /r/<token> confirm page (either op is allowed; `a` picks the default)
 *   a = "unsubscribe"      → /unsubscribe?t=<token> and the List-Unsubscribe one-click POST
 * `due` pins the reminder's due date at send time, so a stale link (already done/snoozed)
 * can't move the reminder twice.
 *
 * Secret: env.REMINDER_SIGNING_SECRET. A clearly-marked insecure default is used ONLY
 * in development (next dev, or the Worker started via `npm run worker:dev`, which sets
 * AQUASLOG_DEV=1). In production a missing secret throws.
 */

export const DEV_SIGNING_SECRET = "aquaslog-DEV-ONLY-insecure-reminder-signing-secret";
export const TOKEN_ACTIONS = ["done", "snooze", "unsubscribe"];

const enc = new TextEncoder();
const dec = new TextDecoder();

function isDevRuntime(env) {
  if (env?.AQUASLOG_DEV === "1") return true;
  return typeof process !== "undefined" && process.env?.NODE_ENV === "development";
}

export function getSigningSecret(env) {
  const configured =
    env?.REMINDER_SIGNING_SECRET ??
    (typeof process !== "undefined" ? process.env?.REMINDER_SIGNING_SECRET : undefined);
  if (configured && String(configured).length >= 16) return String(configured);
  if (isDevRuntime(env)) return DEV_SIGNING_SECRET;
  throw new Error("REMINDER_SIGNING_SECRET is not configured (min 16 chars)");
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/**
 * @param {object} env
 * @param {{ action: string, reminderId?: number, userId: number, dueDate?: string, ttlDays?: number }} p
 */
export async function signToken(env, { action, reminderId = null, userId, dueDate = null, ttlDays = 30, now = Date.now() }) {
  if (!TOKEN_ACTIONS.includes(action)) throw new Error(`signToken: bad action ${action}`);
  const payload = { a: action, rid: reminderId, uid: userId, due: dueDate, exp: Math.floor(now / 1000) + ttlDays * 86400 };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(getSigningSecret(env));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/**
 * @returns {Promise<{ ok: true, action, reminderId, userId, dueDate, exp } | { ok: false, reason: "malformed"|"signature"|"expired" }>}
 */
export async function verifyToken(env, token, { now = Date.now() } = {}) {
  if (typeof token !== "string" || token.length > 1024) return { ok: false, reason: "malformed" };
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return { ok: false, reason: "malformed" };
  let sigBytes;
  try { sigBytes = unb64url(sig); } catch { return { ok: false, reason: "malformed" }; }
  const key = await hmacKey(getSigningSecret(env));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(body));
  if (!valid) return { ok: false, reason: "signature" };
  let p;
  try { p = JSON.parse(dec.decode(unb64url(body))); } catch { return { ok: false, reason: "malformed" }; }
  if (!TOKEN_ACTIONS.includes(p?.a) || !Number.isInteger(p?.uid)) return { ok: false, reason: "malformed" };
  if (!Number.isFinite(p.exp) || p.exp * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true, action: p.a, reminderId: p.rid ?? null, userId: p.uid, dueDate: p.due ?? null, exp: p.exp };
}

/** verifyToken for request handlers: a missing secret is logged and treated as an invalid link. */
export async function safeVerifyToken(env, token) {
  try {
    return await verifyToken(env, token);
  } catch (err) {
    console.error("verifyToken:", err?.message);
    return { ok: false, reason: "config" };
  }
}
