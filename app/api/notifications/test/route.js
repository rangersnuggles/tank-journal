export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getUserSettings } from "@/lib/reminders/service";
import { sendTestDigest } from "@/lib/reminders/digest";

// Sends the current digest to the signed-in user (no claim, no nag throttle).
// With EMAIL_MODE=log it lands in /dev/outbox.
export async function POST(request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDB();
  const settings = await getUserSettings(db, user.user_id);
  try {
    const result = await sendTestDigest(db, getRequestContext().env, {
      user: { id: user.user_id, email: user.email },
      timezone: settings.timezone,
      origin: new URL(request.url).origin,
    });
    if (!result.sent) return Response.json({ error: "Add a reminder first — the test email shows your reminders." }, { status: 400 });
    return Response.json(result);
  } catch (err) {
    console.error("notifications/test failed:", err?.message);
    return Response.json({ error: "Could not send the test email." }, { status: 500 });
  }
}
