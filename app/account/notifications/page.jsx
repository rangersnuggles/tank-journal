export const runtime = "edge";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { getSession } from "@/lib/session";
import { getDB } from "@/lib/db";
import Nav from "@/components/Nav";
import NotificationSettings from "@/components/NotificationSettings";
import CalendarSettings from "@/components/CalendarSettings";
import { getUserSettings } from "@/lib/reminders/service";
import { getFeed, feedUrls, originFromHeaders } from "@/lib/calendar/feed";

export const metadata = { title: "Email & calendar reminders — AquaSlog" };

export default async function NotificationsPage() {
  const h = await headers();
  const user = await getSession({ headers: h });
  if (!user) redirect("/login");
  const db = getDB();
  const settings = await getUserSettings(db, user.user_id);

  // The calendar section must never take the email settings down with it
  // (e.g. migration 0005 not applied yet, or the signing secret missing).
  let calendar = null;
  let calendarUnavailable = false;
  try {
    const feed = await getFeed(db, getRequestContext().env, user.user_id);
    if (feed) calendar = { urls: feedUrls(originFromHeaders(h), feed.token) };
  } catch (err) {
    console.error("calendar settings unavailable:", err?.message);
    calendarUnavailable = true;
  }

  return (
    <>
      <Nav user={user} />
      <NotificationSettings initial={settings} email={user.email}>
        <CalendarSettings initial={calendar} unavailable={calendarUnavailable} />
      </NotificationSettings>
    </>
  );
}
