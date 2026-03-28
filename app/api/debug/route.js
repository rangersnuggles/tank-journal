export const runtime = "edge";

import { getDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const results = {};

  // 1. Can we call getDB()?
  try {
    const db = getDB();
    results.db = db ? "ok" : "null";
  } catch (e) {
    results.db = `ERROR: ${e.message}`;
  }

  // 2. Can we query D1?
  try {
    const db = getDB();
    const row = await db.prepare("SELECT 1 as val").first();
    results.d1_query = row ? "ok" : "null";
  } catch (e) {
    results.d1_query = `ERROR: ${e.message}`;
  }

  // 3. Can we hash a password?
  try {
    const hash = await hashPassword("testpassword");
    results.pbkdf2 = hash ? "ok" : "null";
  } catch (e) {
    results.pbkdf2 = `ERROR: ${e.message}`;
  }

  // 4. Can we query the users table?
  try {
    const db = getDB();
    const row = await db.prepare("SELECT COUNT(*) as n FROM users").first();
    results.users_table = `ok (${row?.n} rows)`;
  } catch (e) {
    results.users_table = `ERROR: ${e.message}`;
  }

  return Response.json(results);
}
