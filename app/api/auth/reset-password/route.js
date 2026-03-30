export const runtime = "edge";

import { getDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request) {
  try {
    const { token, password } = await request.json();
    if (!token || !password) {
      return Response.json({ error: "Token and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const db = getDB();
    const row = await db
      .prepare(`SELECT user_id FROM password_resets WHERE token = ? AND expires_at > datetime('now')`)
      .bind(token)
      .first();

    if (!row) {
      return Response.json({ error: "Reset link is invalid or has expired" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    await db
      .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
      .bind(passwordHash, row.user_id)
      .run();

    // Invalidate the token and all existing sessions
    await db.prepare(`DELETE FROM password_resets WHERE token = ?`).bind(token).run();
    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(row.user_id).run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error("reset-password error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
