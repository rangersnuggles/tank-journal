export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { runDigest } from "@/lib/reminders/digest";

/**
 * DEV ONLY (404 unless `next dev`): run the reminder digest now, writing emails to the
 * local outbox. POST { ignoreHour?: boolean, resetToday?: boolean }
 *   ignoreHour  — send even if it's before each user's digest hour
 *   resetToday  — forget today's digest claims first, so you can re-send
 */
export async function POST(request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const body = await request.json().catch(() => ({}));
  const env = getRequestContext().env;
  const db = getDB();
  if (body.resetToday) {
    // Local dates differ per timezone; clear anything claimed in the last day.
    await db.batch([
      db.prepare(`DELETE FROM reminder_digests WHERE created_at > datetime('now', '-1 day')`),
      db.prepare(`UPDATE reminders SET notify_count = 0, last_notified_on = NULL WHERE last_notified_on >= date('now', '-1 day')`),
    ]);
  }
  const summary = await runDigest(db, env, new Date(), {
    ignoreHour: !!body.ignoreHour,
    origin: new URL(request.url).origin,
    // The outbox dedupes on the idempotency key; a forced re-send needs a fresh one.
    idemSuffix: body.resetToday ? `/dev-${Date.now()}` : "",
    log: (m) => console.log(m),
  });
  return Response.json(summary);
}
