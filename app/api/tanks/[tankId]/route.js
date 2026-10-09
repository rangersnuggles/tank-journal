export const runtime = "edge";

import { getDB } from "@/lib/db";
import { getSession, requireSession } from "@/lib/session";

const SLUG_RE = /^[a-z0-9_-]+$/i;

/** "" / whitespace / null → null (no public URL); otherwise validated + lowercased. */
function normalizeSlug(raw) {
  if (raw == null) return { slug: null };
  if (typeof raw !== "string") return { error: "Slug must be a string" };
  const trimmed = raw.trim();
  if (trimmed === "") return { slug: null };
  if (!SLUG_RE.test(trimmed)) {
    return { error: "Slug may only contain letters, numbers, hyphens, and underscores" };
  }
  return { slug: trimmed.toLowerCase() };
}

async function getTankForUser(db, tankId, userId) {
  const tank = await db.prepare(`SELECT * FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return { error: "Tank not found", status: 404 };
  if (tank.user_id !== userId) return { error: "Forbidden", status: 403 };
  return { tank };
}

export async function GET(request, { params }) {
  const { tankId } = await params;
  const db = getDB();

  const tank = await db.prepare(`SELECT * FROM tanks WHERE id = ?`).bind(tankId).first();
  if (!tank) return Response.json({ error: "Tank not found" }, { status: 404 });

  // Public tanks can be read without auth
  if (!tank.is_public) {
    const user = await getSession(request);
    if (!user || user.user_id !== tank.user_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return Response.json(tank);
}

export async function PATCH(request, { params }) {
  const { tankId } = await params;
  const user = await requireSession(request);
  const db = getDB();

  const { error, status, tank } = await getTankForUser(db, tankId, user.user_id);
  if (error) return Response.json({ error }, { status });

  const body = await request.json();
  const allowed = ["name", "description", "slug", "is_public"];
  const updates = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = key === "is_public" ? (body[key] ? 1 : 0) : body[key];
    }
  }
  if ("name" in updates) {
    const name = typeof updates.name === "string" ? updates.name.trim() : "";
    if (!name) return Response.json({ error: "name is required" }, { status: 400 });
    updates.name = name;
  }
  if ("slug" in updates) {
    // The settings page always sends slug (even for private tanks), often as "".
    // Store "" as NULL so several slug-less tanks don't collide on UNIQUE(user_id, slug).
    const { slug, error: slugError } = normalizeSlug(updates.slug);
    if (slugError) return Response.json({ error: slugError }, { status: 400 });
    updates.slug = slug;
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(updates), tankId];

  try {
    await db
      .prepare(`UPDATE tanks SET ${setClauses} WHERE id = ?`)
      .bind(...values)
      .run();
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return Response.json({ error: "You already have a tank with that slug" }, { status: 409 });
    }
    throw err;
  }

  const updated = await db.prepare(`SELECT * FROM tanks WHERE id = ?`).bind(tankId).first();
  return Response.json(updated);
}

export async function DELETE(request, { params }) {
  const { tankId } = await params;
  const user = await requireSession(request);
  const db = getDB();

  const { error, status } = await getTankForUser(db, tankId, user.user_id);
  if (error) return Response.json({ error }, { status });

  // CASCADE in schema handles entries + inhabitants deletion
  await db.prepare(`DELETE FROM tanks WHERE id = ?`).bind(tankId).run();
  return new Response(null, { status: 204 });
}
