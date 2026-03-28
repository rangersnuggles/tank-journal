/**
 * Tank Journal — Supabase CSV → D1 migration script
 *
 * Usage:
 *   node scripts/migrate-to-d1.mjs <inhabitants.csv> <entries.csv> <email> <username> [display_name]
 *
 * Example:
 *   node scripts/migrate-to-d1.mjs ~/Downloads/inhabitants_rows.csv ~/Downloads/entries_rows.csv rob@example.com rob "Rob"
 *
 * What it does:
 *   1. Parses both CSVs (handles quoted fields, escaped quotes)
 *   2. Creates a user (prompts for password)
 *   3. Creates a default tank owned by that user
 *   4. Inserts all inhabitants and entries into D1
 *
 * Re-run safe: INSERT OR IGNORE skips duplicates.
 */

import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { createInterface } from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Args ─────────────────────────────────────────────────────────────────────
const [inhabCsv, entriesCsv, email, username, displayName] = process.argv.slice(2);

if (!inhabCsv || !entriesCsv || !email || !username) {
  console.error(
    "Usage: node scripts/migrate-to-d1.mjs <inhabitants.csv> <entries.csv> <email> <username> [display_name]"
  );
  process.exit(1);
}

// ── CSV parser ────────────────────────────────────────────────────────────────
// Handles: quoted fields, escaped double-quotes (""), embedded newlines
function parseCsv(text) {
  const rows = [];
  let headers = null;
  let field = "";
  let inQuotes = false;
  let row = [];

  const flush = () => {
    row.push(field);
    field = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"')           { inQuotes = false; }
      else                           { field += ch; }
    } else {
      if      (ch === '"')  { inQuotes = true; }
      else if (ch === ',')  { flush(); }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        flush();
        if (row.length > 1 || row[0] !== "") {
          if (!headers) { headers = row; }
          else {
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = row[idx] ?? ""; });
            rows.push(obj);
          }
        }
        row = [];
      } else { field += ch; }
    }
  }
  // last row
  flush();
  if (row.length > 1 || row[0] !== "") {
    if (headers) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = row[idx] ?? ""; });
      rows.push(obj);
    }
  }
  return rows;
}

// ── Load CSVs ─────────────────────────────────────────────────────────────────
const inhabitants = parseCsv(readFileSync(resolve(process.cwd(), inhabCsv), "utf8"));
const entries     = parseCsv(readFileSync(resolve(process.cwd(), entriesCsv), "utf8"));

console.log(`\nLoaded: ${inhabitants.length} inhabitants, ${entries.length} entries`);
console.log(`Creating user: ${email} / @${username}\n`);

// ── Password prompt ───────────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await new Promise(res => rl.question("Set a password for this account: ", res));
rl.close();

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

// ── Hash password (PBKDF2 via Web Crypto) ─────────────────────────────────────
const ITERATIONS = 100_000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const keyMaterial = await crypto.subtle.importKey(
  "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
);
const derived = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  keyMaterial, 256
);
const saltB64 = btoa(String.fromCharCode(...salt));
const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
const passwordHash = `${ITERATIONS}:${saltB64}:${hashB64}`;

// ── SQL helpers ───────────────────────────────────────────────────────────────
function sq(val) {
  if (val === null || val === undefined || val === "") return "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
}

// ── Build SQL ─────────────────────────────────────────────────────────────────
const lines = [];

lines.push(`INSERT OR IGNORE INTO users (email, username, display_name, password_hash)
VALUES (${sq(email.toLowerCase())}, ${sq(username.toLowerCase())}, ${sq(displayName || username)}, ${sq(passwordHash)});`);

lines.push(`INSERT OR IGNORE INTO tanks (user_id, name, description, slug, is_public)
SELECT id, 'My Tank', NULL, NULL, 0 FROM users WHERE email = ${sq(email.toLowerCase())} LIMIT 1;`);

for (const inh of inhabitants) {
  const dateAdded = inh.date_added ? inh.date_added.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const createdAt = inh.created_at ? inh.created_at.slice(0, 19).replace("T", " ") : new Date().toISOString().slice(0, 19).replace("T", " ");
  const count = inh.count !== "" && inh.count != null ? inh.count : "NULL";

  lines.push(`INSERT OR IGNORE INTO inhabitants (tank_id, name, count, date_added, notes, created_at)
SELECT t.id, ${sq(inh.name)}, ${count}, ${sq(dateAdded)}, ${sq(inh.notes)}, ${sq(createdAt)}
FROM tanks t JOIN users u ON u.id = t.user_id WHERE u.email = ${sq(email.toLowerCase())} LIMIT 1;`);
}

for (const entry of entries) {
  // Supabase exports jsonb as a JSON string in CSV — may have outer quotes already stripped by parser
  let dataStr = entry.data || "{}";
  // Validate it's parseable JSON; if not, wrap as empty object
  try { JSON.parse(dataStr); } catch { dataStr = "{}"; }

  const entryDate = entry.date ? entry.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const createdAt = entry.created_at ? entry.created_at.slice(0, 19).replace("T", " ") : new Date().toISOString().slice(0, 19).replace("T", " ");

  lines.push(`INSERT OR IGNORE INTO entries (tank_id, type, date, time, data, note, created_at)
SELECT t.id, ${sq(entry.type)}, ${sq(entryDate)}, ${sq(entry.time)}, ${sq(dataStr)}, ${sq(entry.note)}, ${sq(createdAt)}
FROM tanks t JOIN users u ON u.id = t.user_id WHERE u.email = ${sq(email.toLowerCase())} LIMIT 1;`);
}

const sql = lines.join("\n\n");

// ── Execute ───────────────────────────────────────────────────────────────────
const tmpPath = resolve(__dirname, "__migration_tmp.sql");
writeFileSync(tmpPath, sql, "utf8");

console.log(`\n${lines.length} SQL statements ready. Pushing to D1…\n`);

try {
  execSync(`npx wrangler d1 execute tank-journal-db --file="${tmpPath}" --remote`, {
    stdio: "inherit",
    cwd: resolve(__dirname, ".."),
  });
  console.log("\n✓ Migration complete!");
  console.log(`  Inhabitants: ${inhabitants.length}`);
  console.log(`  Entries:     ${entries.length}`);
} finally {
  unlinkSync(tmpPath);
}
