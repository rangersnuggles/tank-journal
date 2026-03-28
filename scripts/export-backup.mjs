/**
 * Tank Journal — Supabase data backup script
 * Run: node scripts/export-backup.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local manually (no dotenv dependency needed) ──────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

let envVars = {};
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    envVars[key] = val;
  }
} catch {
  console.error("Could not read .env.local — make sure it exists in the project root.");
  process.exit(1);
}

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseKey = envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Export ──────────────────────────────────────────────────────────────────
console.log("Connecting to Supabase...");

const { data: inhabitants, error: inhErr } = await supabase
  .from("inhabitants")
  .select("*")
  .order("id");

if (inhErr) {
  console.error("Failed to fetch inhabitants:", inhErr.message);
  process.exit(1);
}

const { data: entries, error: entErr } = await supabase
  .from("entries")
  .select("*")
  .order("id");

if (entErr) {
  console.error("Failed to fetch entries:", entErr.message);
  process.exit(1);
}

const backup = {
  exported_at: new Date().toISOString(),
  supabase_url: supabaseUrl,
  tables: {
    inhabitants,
    entries,
  },
  counts: {
    inhabitants: inhabitants.length,
    entries: entries.length,
  },
};

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outPath = resolve(__dirname, `../tank-journal-backup-${timestamp}.json`);

writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf8");

console.log(`\n✓ Backup complete!`);
console.log(`  Inhabitants: ${inhabitants.length} rows`);
console.log(`  Entries:     ${entries.length} rows`);
console.log(`  Saved to:    ${outPath}`);
