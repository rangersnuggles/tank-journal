export const runtime = "edge";

import { getDB } from "@/lib/db";
import { accountSession, jsonError, publicUser, readJson } from "@/lib/account";
import { displayNameError, normalizeUsername, usernameError } from "@/lib/validation";

/**
 * PATCH /api/account/profile  { display_name?, username? }
 * Changing the username changes every public tank URL (/t/:username/:slug).
 */
export async function PATCH(request) {
  const { user, response } = await accountSession(request);
  if (response) return response;

  try {
    const body = await readJson(request);
    const db = getDB();

    let username = user.username;
    if (body.username !== undefined) {
      username = normalizeUsername(body.username);
      const err = usernameError(username);
      if (err) return jsonError(err, 400, { field: "username" });
    }

    let displayName = user.display_name;
    if (body.display_name !== undefined) {
      displayName = String(body.display_name ?? "").trim();
      const err = displayNameError(displayName);
      if (err) return jsonError(err, 400, { field: "display_name" });
      // Same default as registration: an empty display name falls back to the username.
      if (!displayName) displayName = username;
    }

    if (username !== user.username) {
      const taken = await db
        .prepare(`SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1`)
        .bind(username, user.user_id)
        .first();
      if (taken) return jsonError("That username is already taken", 409, { field: "username" });
    }

    try {
      await db
        .prepare(`UPDATE users SET username = ?, display_name = ? WHERE id = ?`)
        .bind(username, displayName, user.user_id)
        .run();
    } catch (err) {
      // Lost a race with another signup for the same username.
      if (/UNIQUE/i.test(String(err?.message))) {
        return jsonError("That username is already taken", 409, { field: "username" });
      }
      throw err;
    }

    return Response.json(
      publicUser({ ...user, username, display_name: displayName })
    );
  } catch (err) {
    console.error("account/profile error:", err);
    return jsonError("Internal server error", 500);
  }
}
