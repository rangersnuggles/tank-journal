export const runtime = "edge";

import { verifyPassword } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/session";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const db = getDB();
    const user = await db
      .prepare(`SELECT id, email, username, display_name, password_hash FROM users WHERE email = ?`)
      .bind(email.toLowerCase())
      .first();

    // Constant-time-ish: always run verifyPassword even when user not found to avoid timing attacks
    const dummyHash = "210000:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const valid = user
      ? await verifyPassword(password, user.password_hash)
      : await verifyPassword(password, dummyHash).then(() => false);

    if (!valid) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const { token, expiresAt } = await createSession(user.id);

    return new Response(
      JSON.stringify({
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": sessionCookie(token, expiresAt),
        },
      }
    );
  } catch (err) {
    console.error("login error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
