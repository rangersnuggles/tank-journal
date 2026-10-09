export const runtime = "edge";

import { getDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { accountSession, checkCurrentPassword, jsonError, readJson } from "@/lib/account";
import { passwordError } from "@/lib/validation";

/**
 * POST /api/account/password  { current_password, new_password }
 * Signs out every OTHER session (this one stays valid) and voids reset links.
 */
export async function POST(request) {
  const { user, token, response } = await accountSession(request);
  if (response) return response;

  try {
    const body = await readJson(request);
    const err = passwordError(body.new_password);
    if (err) return jsonError(err, 400, { field: "new_password" });

    const bad = await checkCurrentPassword(user.user_id, body.current_password);
    if (bad) return bad;

    const db = getDB();
    const passwordHash = await hashPassword(body.new_password);
    const results = await db.batch([
      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(passwordHash, user.user_id),
      db.prepare(`DELETE FROM sessions WHERE user_id = ? AND id != ?`).bind(user.user_id, token),
      db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(user.user_id),
    ]);

    return Response.json({ ok: true, other_sessions_signed_out: results[1]?.meta?.changes ?? 0 });
  } catch (err) {
    console.error("account/password error:", err);
    return jsonError("Internal server error", 500);
  }
}
