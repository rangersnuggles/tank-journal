export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rotateFeed, feedUrls } from "@/lib/calendar/feed";

// POST → new token; the previous /cal/<token>.ics URL 404s immediately.
export async function POST(request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const feed = await rotateFeed(getDB(), getRequestContext().env, user.user_id);
    return Response.json(
      { enabled: true, created_at: feed.created_at, updated_at: feed.updated_at, urls: feedUrls(new URL(request.url).origin, feed.token) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("calendar reset failed:", err?.message);
    return Response.json({ error: "Could not reset the calendar link." }, { status: 500 });
  }
}
