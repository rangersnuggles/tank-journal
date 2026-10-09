/**
 * Daily reminder digest.
 *
 *   await runDigest(db, env, new Date(), { ignoreHour, maxSends, origin })
 *
 * Shared by the reminders Worker (cron "7 * * * *") and the dev-only "Run reminder
 * digest now" button. Takes db/env as params — never imports lib/db.js.
 *
 * Per user with reminder email on and not unsubscribed:
 *   1. local date/hour from their IANA timezone (Intl); skip until local hour >= digest_hour
 *   2. pick due items with a nag throttle: on the due day (or first run after), then
 *      every 3 days, at most 3 emails per due date (due, +3, +6) — then stop emailing
 *   3. claim reminder_digests(user_id, local_date) — INSERT … ON CONFLICT; proceed only
 *      if changes === 1 (a failed or stale-claimed row may be re-claimed, max 3 attempts)
 *   4. send one email grouped by tank, Idempotency-Key digest/{user}/{localDate}
 *   5. mark the digest sent and bump notify_count / last_notified_on on the items
 */

import { addDays, diffDays, zonedParts, fmtShortDate, fmtAgo, dueState, fmtInterval, maxDate } from "./dates.js";
import { TASK_TYPES, reminderTitle } from "./match.js";
import { lastDoneByTank } from "./service.js";
import { signToken, getSigningSecret } from "./tokens.js";
import { sendEmail } from "../email/send.js";
import { renderDigestEmail } from "../email/reminderDigest.js";

export const MAX_NAGS = 3;
export const NAG_EVERY_DAYS = 3;
export const DEFAULT_MAX_SENDS = 40;

/** Throttle: include a due reminder on the first digest, then every 3 days, max 3 times. */
export function nagEligible(r, localDate) {
  if (r.status !== "active" || r.due_date > localDate) return false;
  const count = r.notify_count || 0;
  if (count >= MAX_NAGS) return false;
  if (count === 0 || !r.last_notified_on) return true;
  return diffDays(localDate, r.last_notified_on) >= NAG_EVERY_DAYS;
}

export function appOrigin(env, override) {
  const o =
    override ||
    env?.APP_ORIGIN ||
    (typeof process !== "undefined" ? process.env?.APP_ORIGIN : undefined) ||
    "https://aquaslog.com";
  return String(o).replace(/\/+$/, "");
}

function localDateLabel(localDate) {
  return new Date(`${localDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

async function dueRemindersForUser(db, userId, localDate) {
  const { results } = await db
    .prepare(
      `SELECT r.*, t.name AS tank_name FROM reminders r JOIN tanks t ON t.id = r.tank_id
       WHERE r.user_id = ? AND r.status = 'active' AND r.due_date <= ?
       ORDER BY t.name ASC, r.due_date ASC, r.id ASC`
    )
    .bind(userId, localDate)
    .all();
  return results;
}

/**
 * Builds the email for `user` on `localDate` from `reminders` (already filtered).
 * @returns {{ subject, html, text, headers }}
 */
export async function buildDigestEmail(db, env, { user, localDate, reminders, origin, test = false }) {
  const base = appOrigin(env, origin);
  const lastByTank = await lastDoneByTank(db, reminders.map((r) => r.tank_id));

  const groupsByTank = new Map();
  for (const r of reminders) {
    const meta = TASK_TYPES[r.task_type] ?? TASK_TYPES.custom;
    const last = maxDate(lastByTank[r.tank_id]?.[r.task_type], r.last_done_on);
    const state = dueState(r.due_date, localDate);
    const [doneTok, snoozeTok] = await Promise.all([
      signToken(env, { action: "done", reminderId: r.id, userId: user.id, dueDate: r.due_date }),
      signToken(env, { action: "snooze", reminderId: r.id, userId: user.id, dueDate: r.due_date }),
    ]);
    const item = {
      title: reminderTitle(r),
      kind: state.kind === "overdue" ? "overdue" : state.kind === "today" ? "today" : "upcoming",
      dueLabel: state.label,
      lastLine: last
        ? `${meta.lastLabel || "Last done"}: ${fmtShortDate(last, localDate)} (${fmtAgo(diffDays(localDate, last))})`
        : meta.lastLabel ? `${meta.lastLabel}: none logged yet` : null,
      everyLine: r.interval_days ? `Every ${fmtInterval(r.interval_days)}` : "One-time reminder",
      doneUrl: `${base}/r/${doneTok}`,
      snoozeUrl: `${base}/r/${snoozeTok}`,
    };
    if (!groupsByTank.has(r.tank_id)) groupsByTank.set(r.tank_id, { tankName: r.tank_name, items: [] });
    groupsByTank.get(r.tank_id).items.push(item);
  }
  const groups = [...groupsByTank.values()];

  const unsubTok = await signToken(env, { action: "unsubscribe", userId: user.id, ttlDays: 365 });
  const email = renderDigestEmail({
    groups,
    test,
    appUrl: `${base}/dashboard`,
    settingsUrl: `${base}/account/notifications`,
    unsubscribeUrl: `${base}/unsubscribe?t=${unsubTok}`,
    localDateLabel: localDateLabel(localDate),
  });
  return {
    ...email,
    headers: {
      // RFC 8058 one-click: mail clients POST "List-Unsubscribe=One-Click" to this URL.
      "List-Unsubscribe": `<${base}/api/email/unsubscribe?t=${unsubTok}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/**
 * @param {D1Database} db
 * @param {object} env   needs REMINDER_SIGNING_SECRET (dev default in development), email config
 * @param {Date} now
 * @param {{ ignoreHour?: boolean, maxSends?: number, origin?: string, log?: (msg) => void, idemSuffix?: string }} [opts]
 *   idemSuffix is for the dev "re-send" button only (the outbox dedupes on the key).
 */
export async function runDigest(db, env, now = new Date(), opts = {}) {
  const { ignoreHour = false, maxSends = DEFAULT_MAX_SENDS, origin, log = () => {}, idemSuffix = "" } = opts;
  getSigningSecret(env); // fail fast (whole run) if links can't be signed

  const summary = { now: now.toISOString(), considered: 0, sent: 0, skipped_hour: 0, nothing_due: 0, already_claimed: 0, empty: 0, failed: 0, capped: false, users: [] };

  // Coarse prefilter: anything due by tomorrow (UTC) — no timezone is more than +14h ahead.
  const horizon = addDays(now.toISOString().slice(0, 10), 1);
  const { results: users } = await db
    .prepare(
      `SELECT u.id, u.email, COALESCE(s.timezone, 'UTC') AS timezone, COALESCE(s.digest_hour, 8) AS digest_hour
       FROM users u LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE COALESCE(s.reminders_email, 1) = 1 AND s.unsubscribed_at IS NULL
         AND EXISTS (SELECT 1 FROM reminders r WHERE r.user_id = u.id AND r.status = 'active'
                     AND r.due_date <= ? AND r.notify_count < ?)
       ORDER BY u.id`
    )
    .bind(horizon, MAX_NAGS)
    .all();

  for (const user of users) {
    if (summary.sent >= maxSends) { summary.capped = true; break; }
    summary.considered++;
    const local = zonedParts(now, user.timezone);
    const rec = { user_id: user.id, local_date: local.date, local_hour: local.hour, timezone: local.timeZone };
    summary.users.push(rec);

    if (!ignoreHour && local.hour < user.digest_hour) { rec.result = "before_digest_hour"; summary.skipped_hour++; continue; }

    const eligible = (await dueRemindersForUser(db, user.id, local.date)).filter((r) => nagEligible(r, local.date));
    if (eligible.length === 0) { rec.result = "nothing_due"; summary.nothing_due++; continue; }

    const claim = await db
      .prepare(
        `INSERT INTO reminder_digests (user_id, local_date) VALUES (?, ?)
         ON CONFLICT(user_id, local_date) DO UPDATE SET status = 'claimed', attempts = reminder_digests.attempts + 1,
           error = NULL, updated_at = datetime('now')
         WHERE reminder_digests.attempts < 3 AND (reminder_digests.status = 'failed'
           OR (reminder_digests.status = 'claimed' AND reminder_digests.updated_at < datetime('now', '-30 minutes')))`
      )
      .bind(user.id, local.date)
      .run();
    if (claim.meta?.changes !== 1) { rec.result = "already_claimed"; summary.already_claimed++; continue; }

    // Re-read after claiming so a concurrent Done/Snooze is respected.
    const items = (await dueRemindersForUser(db, user.id, local.date)).filter((r) => nagEligible(r, local.date));
    if (items.length === 0) {
      await db.prepare(`UPDATE reminder_digests SET status = 'empty', updated_at = datetime('now') WHERE user_id = ? AND local_date = ?`).bind(user.id, local.date).run();
      rec.result = "empty"; summary.empty++; continue;
    }

    try {
      const email = await buildDigestEmail(db, env, { user, localDate: local.date, reminders: items, origin });
      const res = await sendEmail(env, {
        to: user.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
        idempotencyKey: `digest/${user.id}/${local.date}${idemSuffix}`,
      });
      const ids = items.map((r) => r.id);
      await db.batch([
        db.prepare(`UPDATE reminder_digests SET status = 'sent', item_count = ?, error = NULL, updated_at = datetime('now') WHERE user_id = ? AND local_date = ?`).bind(items.length, user.id, local.date),
        db.prepare(`UPDATE reminders SET last_notified_on = ?, notify_count = notify_count + 1 WHERE id IN (${ids.map(() => "?").join(", ")})`).bind(local.date, ...ids),
      ]);
      rec.result = res?.duplicate ? "sent_duplicate" : "sent";
      rec.items = items.length;
      summary.sent++;
      log(`digest: user ${user.id} ${local.date} → ${items.length} item(s) (${res?.mode})`);
    } catch (err) {
      const msg = String(err?.message || err).slice(0, 500);
      await db.prepare(`UPDATE reminder_digests SET status = 'failed', error = ?, updated_at = datetime('now') WHERE user_id = ? AND local_date = ?`).bind(msg, user.id, local.date).run();
      rec.result = "failed"; rec.error = msg; summary.failed++;
      log(`digest: user ${user.id} failed: ${msg}`);
    }
  }
  return summary;
}

/** Test email for the notifications page: current due items (or the next few upcoming), no claim/throttle. */
export async function sendTestDigest(db, env, { user, timezone, now = new Date(), origin }) {
  const local = zonedParts(now, timezone);
  let reminders = await dueRemindersForUser(db, user.id, local.date);
  if (reminders.length === 0) {
    const { results } = await db
      .prepare(
        `SELECT r.*, t.name AS tank_name FROM reminders r JOIN tanks t ON t.id = r.tank_id
         WHERE r.user_id = ? AND r.status = 'active' ORDER BY r.due_date ASC LIMIT 3`
      )
      .bind(user.id)
      .all();
    reminders = results; // nothing due yet — preview the next few upcoming items
  }
  if (reminders.length === 0) return { sent: false, reason: "no_reminders" };
  const email = await buildDigestEmail(db, env, { user, localDate: local.date, reminders, origin, test: true });
  const res = await sendEmail(env, {
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: email.headers,
    idempotencyKey: `digest-test/${user.id}/${now.getTime()}`,
  });
  return { sent: true, mode: res.mode, items: reminders.length };
}
