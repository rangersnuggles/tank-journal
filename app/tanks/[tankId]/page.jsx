export const runtime = "edge";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { getDB } from "@/lib/db";
import Nav from "@/components/Nav";
import TankJournal from "@/components/TankJournal";

export default async function TankPage(props) {
  const { tankId } = await props.params;
  const user = await getSession({ headers: await headers() });

  const db = getDB();
  const tank = await db.prepare(`SELECT * FROM tanks WHERE id = ?`).bind(tankId).first();

  if (!tank) redirect("/dashboard");
  const isOwner = !!user && user.user_id === tank.user_id;
  if (!tank.is_public && !isOwner) redirect("/login");

  // Public tanks are viewable by anyone, but only the owner gets edit UI
  // (the API enforces ownership on writes regardless).
  return (
    <>
      {user && <Nav user={user} />}
      <TankJournal tankId={Number(tankId)} tank={tank} readOnly={!isOwner} />
    </>
  );
}
