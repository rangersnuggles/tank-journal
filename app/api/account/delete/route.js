export const runtime = "edge";

import { getDB } from "@/lib/db";
import { clearSessionCookie } from "@/lib/session";
import { accountSession, checkCurrentPassword, jsonError, readJson } from "@/lib/account";
import { normalizeUsername } from "@/lib/validation";

/**
 * POST /api/account/delete  { username, current_password }
 *
 * Permanently deletes the user and everything they own, then clears the cookie.
 * Every table references users/tanks with ON DELETE CASCADE (migrations/0001), and
 * D1 enforces foreign keys, so deleting the user row alone would be enough; the
 * known child tables are also deleted explicitly so this doesn't depend on FK
 * enforcement. All statements run in one batch (a single transaction): if a
 * future table blocks the delete, nothing is removed.
 */
export async function POST(request) {
  const { user, response } = await accountSession(request);
  if (response) return response;

  try {
    const body = await readJson(request);
    if (normalizeUsername(body.username) !== user.username) {
      return jsonError("Type your username exactly to confirm", 400, { field: "username" });
    }
    const bad = await checkCurrentPassword(user.user_id, body.current_password);
    if (bad) return bad;

    const db = getDB();
    const id = user.user_id;
    const tankIds = `SELECT id FROM tanks WHERE user_id = ?`;
    await db.batch([
      db.prepare(`DELETE FROM entries WHERE tank_id IN (${tankIds})`).bind(id),
      db.prepare(`DELETE FROM inhabitants WHERE tank_id IN (${tankIds})`).bind(id),
      db.prepare(`DELETE FROM tanks WHERE user_id = ?`).bind(id),
      db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(id),
      db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id),
      db.prepare(`DELETE FROM users WHERE id = ?`).bind(id),
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(),
      },
    });
  } catch (err) {
    console.error("account/delete error:", err);
    return jsonError("Internal server error", 500);
  }
}
