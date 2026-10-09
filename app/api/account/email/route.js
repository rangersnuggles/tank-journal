export const runtime = "edge";

import { getDB } from "@/lib/db";
import {
  accountSession,
  checkCurrentPassword,
  jsonError,
  publicUser,
  readJson,
} from "@/lib/account";
import { emailError, normalizeEmail } from "@/lib/validation";

/**
 * POST /api/account/email  { email, current_password }
 * Also invalidates any outstanding password-reset links (they were sent to the old address).
 */
export async function POST(request) {
  const { user, response } = await accountSession(request);
  if (response) return response;

  try {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const err = emailError(email);
    if (err) return jsonError(err, 400, { field: "email" });

    const bad = await checkCurrentPassword(user.user_id, body.current_password);
    if (bad) return bad;

    if (email === user.email) {
      return Response.json(publicUser(user));
    }

    const db = getDB();
    const taken = await db
      .prepare(`SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1`)
      .bind(email, user.user_id)
      .first();
    if (taken) return jsonError("That email is already in use", 409, { field: "email" });

    try {
      await db.batch([
        db.prepare(`UPDATE users SET email = ? WHERE id = ?`).bind(email, user.user_id),
        db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(user.user_id),
      ]);
    } catch (e) {
      if (/UNIQUE/i.test(String(e?.message))) {
        return jsonError("That email is already in use", 409, { field: "email" });
      }
      throw e;
    }

    return Response.json(publicUser({ ...user, email }));
  } catch (err) {
    console.error("account/email error:", err);
    return jsonError("Internal server error", 500);
  }
}
