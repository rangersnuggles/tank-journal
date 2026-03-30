export const runtime = "edge";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDB } from "@/lib/db";
import Nav from "@/components/Nav";

const serifFamily = "'Lora', serif";
const sansFamily  = "'DM Sans', sans-serif";

export default async function DashboardPage() {
  const user = await getSession({ headers: await headers() });
  if (!user) redirect("/login");

  const db = getDB();
  const { results: tanks } = await db
    .prepare(
      `SELECT t.*,
        (SELECT COUNT(*) FROM entries e WHERE e.tank_id = t.id) as entry_count
       FROM tanks t WHERE t.user_id = ? ORDER BY t.created_at ASC`
    )
    .bind(user.user_id)
    .all();

  return (
    <>
      <Nav user={user} />
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "48px 24px 80px", fontFamily: sansFamily }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontFamily: serifFamily, fontSize: "26px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              My Tanks
            </h1>
            <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: 0 }}>
              {tanks.length === 0 ? "No tanks yet" : `${tanks.length} tank${tanks.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/tanks/new" style={{
            background: "var(--color-accent)", color: "#fff", textDecoration: "none",
            borderRadius: "7px", padding: "8px 16px", fontSize: "13px", fontWeight: 500,
          }}>+ New Tank</Link>
        </div>

        {tanks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--color-text-subtle)" }}>
            <p style={{ fontSize: "14px", marginBottom: "16px" }}>You don't have any tanks yet.</p>
            <Link href="/tanks/new" style={{ color: "var(--color-accent)", textDecoration: "none", fontSize: "13px" }}>Create your first tank →</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {tanks.map(tank => (
              <Link key={tank.id} href={`/tanks/${tank.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  border: "1px solid var(--color-border-faint)", borderRadius: "10px", padding: "20px 22px",
                  background: "var(--color-bg)", cursor: "pointer",
                  transition: "border-color 0.15s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <h2 style={{ fontFamily: serifFamily, fontSize: "17px", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
                      {tank.name}
                    </h2>
                    {tank.is_public ? (
                      <span style={{ fontSize: "10px", background: "var(--color-tag-public-bg)", color: "var(--color-tag-public-text)", border: "1px solid var(--color-tag-public-border)", borderRadius: "4px", padding: "2px 7px", fontWeight: 600, flexShrink: 0, marginLeft: "8px" }}>Public</span>
                    ) : (
                      <span style={{ fontSize: "10px", background: "var(--color-tag-private-bg)", color: "var(--color-tag-private-text)", border: "1px solid var(--color-tag-private-border)", borderRadius: "4px", padding: "2px 7px", flexShrink: 0, marginLeft: "8px" }}>Private</span>
                    )}
                  </div>
                  {tank.description && (
                    <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "0 0 10px", lineHeight: "1.5" }}>{tank.description}</p>
                  )}
                  <div style={{ fontSize: "11px", color: "var(--color-text-subtle)" }}>
                    {tank.entry_count} {tank.entry_count === 1 ? "entry" : "entries"}
                    {tank.slug && tank.is_public && (
                      <span style={{ marginLeft: "8px" }}>· /t/{user.username}/{tank.slug}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
