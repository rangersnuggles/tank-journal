/**
 * Private calendar subscription links (migration 0005, table calendar_feeds).
 *
 * The URL token is derived, never stored:
 *   token      = base64url(HMAC-SHA256(REMINDER_SIGNING_SECRET, "aquaslog-calendar-feed:v1:" + nonce))
 *   token_hash = hex(SHA-256(token))
 * The row holds only the random nonce and the hash. The feed route looks a request up
 * by hash (no secret needed); the settings page re-derives the token to show the URL
 * again. Rotating the nonce ("Reset link") makes the old URL 404 immediately. Changing
 * REMINDER_SIGNING_SECRET changes every user's URL (old ones 404 until they re-copy).
 *
 * Takes `db`/`env` as params (never imports lib/db.js). Web Crypto only — edge safe.
 */

import { getSigningSecret } from "../reminders/tokens.js";
import { zonedParts, maxDate } from "../reminders/dates.js";
import { lastDoneByTank } from "../reminders/service.js";
import { buildReminderFeed, buildReminderIcs, ALARM_DEFAULT, ALARM_TIME_RE } from "./ics.js";

const enc = new TextEncoder();
const LABEL = "aquaslog-calendar-feed:v1:";
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // base64url of 32 bytes

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomNonce() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

/** URL token for a nonce (needs the signing secret). */
export async function deriveFeedToken(secret, nonce) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(LABEL + nonce))));
}

export async function hashFeedToken(token) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(token))));
}

/** { https, webcal, google } subscription URLs for a token. */
export function feedUrls(origin, token) {
  const https = `${String(origin).replace(/\/+$/, "")}/cal/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}

/** Origin of the current request from (Next) headers: host + x-forwarded-proto. */
export function originFromHeaders(h) {
  const host = h.get("host") || "aquaslog.com";
  const proto = (h.get("x-forwarded-proto") || "").split(",")[0].trim() || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

// ── DB ──────────────────────────────────────────────────────────────────────

/** The user's feed { token, created_at, updated_at } or null if they never created one. */
export async function getFeed(db, env, userId) {
  const row = await db.prepare(`SELECT token_nonce, created_at, updated_at FROM calendar_feeds WHERE user_id = ?`).bind(userId).first();
  if (!row) return null;
  return { token: await deriveFeedToken(getSigningSecret(env), row.token_nonce), created_at: row.created_at, updated_at: row.updated_at };
}

async function newNonceAndHash(env) {
  const nonce = randomNonce();
  const token = await deriveFeedToken(getSigningSecret(env), nonce);
  return { nonce, hash: await hashFeedToken(token) };
}

/** Creates the user's feed if missing (idempotent). Returns { feed, created }. */
export async function createFeed(db, env, userId) {
  const { nonce, hash } = await newNonceAndHash(env);
  const { meta } = await db
    .prepare(`INSERT INTO calendar_feeds (user_id, token_nonce, token_hash) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING`)
    .bind(userId, nonce, hash)
    .run();
  return { feed: await getFeed(db, env, userId), created: (meta?.changes ?? 0) > 0 };
}

/** Replaces the user's token (creating the row if needed). The old URL stops working at once. */
export async function rotateFeed(db, env, userId) {
  const { nonce, hash } = await newNonceAndHash(env);
  await db
    .prepare(
      `INSERT INTO calendar_feeds (user_id, token_nonce, token_hash) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET token_nonce = excluded.token_nonce, token_hash = excluded.token_hash,
         updated_at = datetime('now')`
    )
    .bind(userId, nonce, hash)
    .run();
  return getFeed(db, env, userId);
}

/**
 * Resolves a URL token to { user_id, timezone } (one indexed query), or null.
 * Malformed tokens are rejected without touching the DB.
 */
export async function findFeedOwner(db, token) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const hash = await hashFeedToken(token);
  return (
    (await db
      .prepare(
        `SELECT f.user_id, COALESCE(s.timezone, 'UTC') AS timezone,
                s.calendar_alert_time AS alarm_time, s.calendar_alert_day AS alarm_day
         FROM calendar_feeds f LEFT JOIN user_settings s ON s.user_id = f.user_id
         WHERE f.token_hash = ?`
      )
      .bind(hash)
      .first()) ?? null
  );
}

// ── Alert setting (user_settings.calendar_alert_time / calendar_alert_day) ─────

function normalizeAlarm(row) {
  const time = row?.time === "none" || ALARM_TIME_RE.test(row?.time ?? "") ? row.time : ALARM_DEFAULT.time;
  return { time, day: Number(row?.day) === -1 ? -1 : 0 };
}

/** { time: "HH:MM" | "none", day: 0 | -1 } with defaults for users who never set it. */
export async function getCalendarAlarm(db, userId) {
  const row = await db
    .prepare(`SELECT calendar_alert_time AS time, calendar_alert_day AS day FROM user_settings WHERE user_id = ?`)
    .bind(userId)
    .first();
  return normalizeAlarm(row);
}

/** Validates + saves { time?, day? }. Returns { alarm } or { error }. */
export async function saveCalendarAlarm(db, userId, body) {
  const next = { ...(await getCalendarAlarm(db, userId)) };
  if ("time" in body) {
    if (body.time !== "none" && !ALARM_TIME_RE.test(String(body.time))) return { error: "time must be HH:MM or \"none\"" };
    next.time = body.time;
  }
  if ("day" in body) {
    if (![0, -1].includes(Number(body.day))) return { error: "day must be 0 or -1" };
    next.day = Number(body.day);
  }
  await db
    .prepare(
      `INSERT INTO user_settings (user_id, calendar_alert_time, calendar_alert_day, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET calendar_alert_time = excluded.calendar_alert_time,
         calendar_alert_day = excluded.calendar_alert_day, updated_at = excluded.updated_at`
    )
    .bind(userId, next.time, next.day)
    .run();
  return { alarm: next };
}

// ── Rendering ───────────────────────────────────────────────────────────────

async function withLastDone(db, reminders) {
  const byTank = await lastDoneByTank(db, reminders.map((r) => r.tank_id));
  return (r) => maxDate(byTank[r.tank_id]?.[r.task_type] ?? null, r.last_done_on) || null;
}

/** The subscription feed text for a resolved owner ({ user_id, timezone }). */
export async function renderFeed(db, owner, { origin, now = new Date() }) {
  const { results: reminders } = await db
    .prepare(
      `SELECT r.*, t.name AS tank_name FROM reminders r JOIN tanks t ON t.id = r.tank_id
       WHERE r.user_id = ? AND r.status = 'active' ORDER BY r.due_date ASC, r.id ASC LIMIT 500`
    )
    .bind(owner.user_id)
    .all();
  const today = zonedParts(now, owner.timezone).date;
  const lastDone = reminders.length ? await withLastDone(db, reminders) : () => null;
  const alarm = normalizeAlarm({ time: owner.alarm_time, day: owner.alarm_day });
  return buildReminderFeed({ reminders, timezone: zonedParts(now, owner.timezone).timeZone, today, origin, now, lastDone, alarm });
}

/** Single-event .ics for one reminder row (must include tank_name). */
export async function renderReminderIcs(db, reminder, { timezone, origin, now = new Date(), alarm = ALARM_DEFAULT }) {
  const lastDone = await withLastDone(db, [reminder]);
  const tz = zonedParts(now, timezone);
  return buildReminderIcs(reminder, { today: tz.date, origin, now, lastDone: lastDone(reminder), timezone: tz.timeZone, alarm });
}
