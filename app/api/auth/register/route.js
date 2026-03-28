export const runtime = "edge";

import { hashPassword } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/session";

export async function POST(request) {
  try {
    const { email, username, password, display_name } = await request.json();

    if (!email || !username || !password) {
      return Response.json(
        { error: "email, username, and password are required" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    // username must be URL-safe
    if (!/^[a-z0-9_-]+$/i.test(username)) {
      return Response.json(
        { error: "Username may only contain letters, numbers, hyphens, and underscores" },
        { status: 400 }
      );
    }

    const db = getDB();

    // Check for existing email / username
    const existing = await db
      .prepare(`SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1`)
      .bind(email.toLowerCase(), username.toLowerCase())
      .first();
    if (existing) {
      return Response.json(
        { error: "Email or username already taken" },
        { status: 409 }
      );
    }

    const password_hash = await hashPassword(password);
    const { meta } = await db
      .prepare(
        `INSERT INTO users (email, username, display_name, password_hash)
         VALUES (?, ?, ?, ?)`
      )
      .bind(
        email.toLowerCase(),
        username.toLowerCase(),
        display_name || username,
        password_hash
      )
      .run();

    const userId = meta.last_row_id;
    const { token, expiresAt } = await createSession(userId);

    return new Response(
      JSON.stringify({ id: userId, email: email.toLowerCase(), username: username.toLowerCase() }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": sessionCookie(token, expiresAt),
        },
      }
    );
  } catch (err) {
    console.error("register error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
