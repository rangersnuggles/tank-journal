export const runtime = "edge";

import { notFound } from "next/navigation";
import { getDB } from "@/lib/db";
import TankJournal from "@/components/TankJournal";

export default async function PublicTankPage(props) {
  const { username, slug } = await props.params;

  const db = getDB();

  // Resolve: username → user → public tank with matching slug
  const row = await db
    .prepare(
      `SELECT t.id as tank_id, t.name, t.description, t.slug, t.is_public,
              u.username, u.display_name as user_display_name
       FROM tanks t
       JOIN users u ON u.id = t.user_id
       WHERE u.username = ? AND t.slug = ? AND t.is_public = 1
       LIMIT 1`
    )
    .bind(username.toLowerCase(), slug.toLowerCase())
    .first();

  if (!row) notFound();

  const tank = {
    id: row.tank_id,
    name: row.name,
    description: row.description,
    slug: row.slug,
    is_public: row.is_public,
    user_display_name: row.user_display_name,
    username: row.username,
  };

  return (
    <TankJournal tankId={row.tank_id} tank={tank} readOnly={true} />
  );
}
