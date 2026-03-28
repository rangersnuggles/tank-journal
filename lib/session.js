import { getDB } from "./db";
import { generateSessionToken } from "./auth";

const SESSION_DURATION_DAYS = 30;

/**
 * Resolves a session token (from cookie or x-session-token header) to a user.
 * Returns { user_id, email, username, display_name } or null.
 */
export async function getSession(request) {
  const token =
    request.headers.get("x-session-token") ??
    parseCookie(request.headers.get("cookie"), "session");

  if (!token) return null;

  try {
    const db = getDB();
    const row = await db
      .prepare(
        `SELECT s.user_id, u.email, u.username, u.display_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > datetime('now')`
      )
      .bind(token)
      .first();
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Like getSession but throws a 401 Response if not authenticated.
 */
export async function requireSession(request) {
  const user = await getSession(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

/**
 * Creates a session row in D1 and returns the token.
 */
export async function createSession(userId) {
  const token = generateSessionToken();
  const db = getDB();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db
    .prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(token, userId, expiresAt)
    .run();

  return { token, expiresAt };
}

/**
 * Deletes a session row from D1.
 */
export async function deleteSession(token) {
  const db = getDB();
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(token).run();
}

/**
 * Builds a Set-Cookie header value for the session token.
 */
export function sessionCookie(token, expiresAt) {
  const expires = new Date(expiresAt).toUTCString();
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expires}`;
}

/**
 * Builds a Set-Cookie header that clears the session cookie.
 */
export function clearSessionCookie() {
  return `session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name) return v ?? null;
  }
  return null;
}
