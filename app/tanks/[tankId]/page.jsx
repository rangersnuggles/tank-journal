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
  if (!tank.is_public && (!user || user.user_id !== tank.user_id)) redirect("/login");

  return (
    <>
      {user && <Nav user={user} />}
      <TankJournal tankId={Number(tankId)} tank={tank} />
    </>
  );
}
