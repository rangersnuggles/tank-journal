export const runtime = "edge";

import { getDB } from "@/lib/db";
import { findFeedOwner, renderFeed } from "@/lib/calendar/feed";

/**
 * GET /cal/<token>.ics — a user's private reminder calendar (public route: the
 * unguessable token is the credential; see lib/calendar/feed.js). Unknown, revoked
 * or malformed tokens get the same bare 404.
 */
function notFound() {
  return new Response("Not found\n", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

export async function GET(request, { params }) {
  const { file } = await params;
  const m = /^([A-Za-z0-9_-]+)\.ics$/.exec(file || "");
  if (!m) return notFound();
  try {
    const db = getDB();
    const owner = await findFeedOwner(db, m[1]);
    if (!owner) return notFound();
    const body = await renderFeed(db, owner, { origin: new URL(request.url).origin });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="aquaslog-reminders.ics"',
        "Cache-Control": "private, max-age=900",
        "X-Robots-Tag": "noindex",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    console.error("calendar feed failed:", err?.message);
    return new Response("Calendar temporarily unavailable\n", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "300" } });
  }
}
