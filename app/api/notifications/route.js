export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getUserSettings, saveUserSettings } from "@/lib/reminders/service";

export async function GET(request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getUserSettings(getDB(), user.user_id));
}

// PATCH { reminders_email?, digest_hour?, timezone? }
export async function PATCH(request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const { settings, error } = await saveUserSettings(getDB(), user.user_id, body);
  if (error) return Response.json({ error }, { status: 400 });
  return Response.json(settings);
}
