export const runtime = "edge";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { getDB } from "@/lib/db";
import Nav from "@/components/Nav";
import AccountSettings from "@/components/account/AccountSettings";

export const metadata = { title: "Account — AquaSlog" };

export default async function AccountPage() {
  const session = await getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const db = getDB();
  const [user, { results: tanks }] = await Promise.all([
    db
      .prepare(`SELECT id, email, username, display_name, created_at FROM users WHERE id = ?`)
      .bind(session.user_id)
      .first(),
    db
      .prepare(
        `SELECT t.id, t.name, t.slug, t.is_public,
           (SELECT COUNT(*) FROM entries e WHERE e.tank_id = t.id) AS entry_count
         FROM tanks t WHERE t.user_id = ? ORDER BY t.created_at ASC, t.id ASC`
      )
      .bind(session.user_id)
      .all(),
  ]);
  if (!user) redirect("/login");

  return (
    <>
      <Nav user={session} />
      <AccountSettings
        user={user}
        tanks={tanks.map((t) => ({ ...t, is_public: !!t.is_public }))}
      />
    </>
  );
}
