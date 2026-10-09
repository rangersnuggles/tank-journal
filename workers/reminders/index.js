/**
 * aquaslog-reminders — scheduled Worker.
 *
 * Cron "7 * * * *": every hour, send each user's daily digest once their local time
 * passes their digest hour. All logic lives in lib/reminders/digest.js (shared with the
 * Pages app's dev-only "Run reminder digest now" button); runDigest is idempotent per
 * user per local day, so overlapping or retried runs are safe.
 */

import { runDigest } from "../../lib/reminders/digest.js";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runDigest(env.DB, env, new Date(event.scheduledTime), { log: (m) => console.log(m) })
        .then((s) => console.log(JSON.stringify({ msg: "reminder digest run", sent: s.sent, considered: s.considered, failed: s.failed, capped: s.capped })))
        .catch((err) => console.error("reminder digest run failed:", err?.message || err))
    );
  },

  // No public HTTP surface.
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
