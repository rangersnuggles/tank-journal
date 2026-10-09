export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { safeVerifyToken } from "@/lib/reminders/tokens";
import { unsubscribeUser } from "@/lib/reminders/service";

/**
 * POST /api/email/unsubscribe?t=<token>
 *
 * - RFC 8058 one-click: mail clients POST "List-Unsubscribe=One-Click"
 *   (application/x-www-form-urlencoded) to the List-Unsubscribe URL, token in the query.
 * - The /unsubscribe confirm page POSTs JSON { t }.
 * There is deliberately no GET handler: link scanners must not unsubscribe people.
 */
export async function POST(request) {
  const url = new URL(request.url);
  let t = url.searchParams.get("t");
  if (!t) {
    const type = request.headers.get("content-type") || "";
    try {
      if (type.includes("application/json")) t = (await request.json())?.t;
      else if (type.includes("form")) t = (await request.formData()).get("t");
    } catch {}
  }
  if (!t) return Response.json({ error: "Missing token" }, { status: 400 });

  const tok = await safeVerifyToken(getRequestContext().env, String(t));
  if (!tok.ok || tok.action !== "unsubscribe") {
    return Response.json({ error: tok.reason === "expired" ? "This link has expired." : "This link is not valid." }, { status: 400 });
  }
  const db = getDB();
  const user = await db.prepare(`SELECT id FROM users WHERE id = ?`).bind(tok.userId).first();
  if (user) await unsubscribeUser(db, tok.userId);
  return Response.json({ ok: true });
}
