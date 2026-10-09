export const runtime = "edge";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { getDB } from "@/lib/db";
import Nav from "@/components/Nav";
import NotificationSettings from "@/components/NotificationSettings";
import { getUserSettings } from "@/lib/reminders/service";

export const metadata = { title: "Email reminders — AquaSlog" };

export default async function NotificationsPage() {
  const user = await getSession({ headers: await headers() });
  if (!user) redirect("/login");
  const settings = await getUserSettings(getDB(), user.user_id);
  return (
    <>
      <Nav user={user} />
      <NotificationSettings initial={settings} email={user.email} />
    </>
  );
}
