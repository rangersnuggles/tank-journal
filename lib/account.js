import { getDB } from "./db";
import { verifyPassword } from "./auth";
import { getSession, getSessionToken } from "./session";

/** JSON error response helper for the /api/account routes. */
export function jsonError(error, status, extra = {}) {
  return Response.json({ error, ...extra }, { status });
}

/** Parses a JSON body, returning {} for an empty/invalid body. */
export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

/**
 * Resolves the session for an /api/account route.
 * Returns { user, token } or { response } (a 401 to return as-is).
 */
export async function accountSession(request) {
  const session = await getSession(request);
  if (!session) return { response: jsonError("Unauthorized", 401) };
  return { user: session, token: getSessionToken(request) };
}

/**
 * Checks `password` against the stored hash for `userId`.
 * Returns null when it matches, or a 401 Response to return when it doesn't.
 */
export async function checkCurrentPassword(userId, password) {
  if (typeof password !== "string" || !password) {
    return jsonError("Current password is required", 400, { field: "current_password" });
  }
  const row = await getDB()
    .prepare(`SELECT password_hash FROM users WHERE id = ?`)
    .bind(userId)
    .first();
  const ok = row ? await verifyPassword(password, row.password_hash) : false;
  return ok ? null : jsonError("Current password is incorrect", 401, { field: "current_password" });
}

/** Public-facing user fields (never the password hash). */
export function publicUser(row) {
  return {
    id: row.id ?? row.user_id,
    email: row.email,
    username: row.username,
    display_name: row.display_name,
    ...(row.created_at ? { created_at: row.created_at } : {}),
  };
}
