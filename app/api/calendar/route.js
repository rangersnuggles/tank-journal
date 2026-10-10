export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getFeed, createFeed, feedUrls, saveCalendarAlarm } from "@/lib/calendar/feed";

function payload(feed, request) {
  if (!feed) return { enabled: false };
  return { enabled: true, created_at: feed.created_at, updated_at: feed.updated_at, urls: feedUrls(new URL(request.url).origin, feed.token) };
}

// GET → { enabled, urls?: { https, webcal, google }, created_at?, updated_at? }
export async function GET(request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const feed = await getFeed(getDB(), getRequestContext().env, user.user_id);
    return Response.json(payload(feed, request), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("calendar GET failed:", err?.message);
    return Response.json({ error: "Calendar links are unavailable right now." }, { status: 500 });
  }
}

// POST → creates the link if the user has none (idempotent); same shape as GET + `created`.
export async function POST(request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { feed, created } = await createFeed(getDB(), getRequestContext().env, user.user_id);
    return Response.json({ ...payload(feed, request), created }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("calendar POST failed:", err?.message);
    return Response.json({ error: "Could not create a calendar link." }, { status: 500 });
  }
}

// PATCH { time?: "HH:MM" | "none", day?: 0 | -1 } → { alarm } — the calendar alert, used by
// the subscription feed and single-event downloads alike (works with or without a link).
export async function PATCH(request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const { alarm, error } = await saveCalendarAlarm(getDB(), user.user_id, body);
  if (error) return Response.json({ error }, { status: 400 });
  return Response.json({ alarm }, { headers: { "Cache-Control": "no-store" } });
}
