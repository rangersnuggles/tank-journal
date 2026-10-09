/**
 * AquaSlog — local demo seed (SYNTHETIC DATA ONLY, LOCAL D1 ONLY)
 *
 *   npm run db:seed:local            # generate + apply to the local D1
 *   node scripts/seed-local.mjs --dry-run   # only write the SQL file
 *
 * Creates (replacing any previous copy):
 *   demo@aquaslog.local   / aquaslog-demo   username "demo"   (owns both tanks)
 *   viewer@aquaslog.local / aquaslog-demo   username "viewer" (no tanks; for testing
 *                                                              non-owner views of public tanks)
 *   "Living Room 75g"  public,  slug 75planted  — weekly water changes, CO₂, 2 medical cases
 *   "Shrimp Cube 10g"  private, no slug         — last water change ~41 days ago
 *
 * Dates are relative to "today" (local time) so reminders always look current,
 * which is why the SQL is generated at seed time into .wrangler/seed-local.sql
 * (gitignored) instead of being checked in.
 *
 * Password hashes come from lib/auth.js's hashPassword (PBKDF2-SHA256, 100k).
 * This script only ever runs `wrangler d1 execute --local`.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../lib/auth.js";
import { localDateStr } from "../lib/dates.js";
import { reminderSeedSql } from "./seed/reminders.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, ".wrangler/seed-local.sql");
const DB_NAME = "tank-journal-db";
const DRY_RUN = process.argv.includes("--dry-run");

if (process.argv.some((a) => a.includes("remote"))) {
  console.error("seed-local.mjs is local-only; refusing to run with a --remote style argument.");
  process.exit(1);
}

const DEMO_EMAIL = "demo@aquaslog.local";
const VIEWER_EMAIL = "viewer@aquaslog.local";
const PASSWORD = "aquaslog-demo";
const TANK_A = "Living Room 75g";
const TANK_B = "Shrimp Cube 10g";

// ── Helpers ─────────────────────────────────────────────────────────────────

// Deterministic PRNG so the shape of the data is stable between resets.
let seed = 0x5eed1234;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const today = new Date();
today.setHours(12, 0, 0, 0);
function dateAgo(n) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

const sq = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const userId = (email) => `(SELECT id FROM users WHERE email = ${sq(email)})`;
const tankId = (name) =>
  `(SELECT id FROM tanks WHERE user_id = ${userId(DEMO_EMAIL)} AND name = ${sq(name)})`;

// ── Entries ─────────────────────────────────────────────────────────────────

const entries = [];
/** createdAt defaults to date+time; override to simulate back-filled entries. */
function entry(tank, type, daysAgo, time, data, note = null, createdAt = null) {
  const date = dateAgo(daysAgo);
  entries.push({ tank, type, date, time, data, note, createdAt: createdAt ?? `${date} ${time}:00` });
}

// Living Room 75g — parameters every ~7–12 days, water change on most.
{
  const days = [];
  for (let d = 176; d > 8; d -= between(7, 12)) days.push(d);
  let spikeLogged = false;
  for (const d of days) {
    const wc = rand() < 0.8;
    const data = {
      temp: pick(["76", "76.5", "77", "77.5", "78"]),
      ph: pick(["6.6", "6.8", "6.8", "7.0"]),
      ammonia: "0",
      nitrite: "0",
      nitrate: pick(["10", "15", "15", "20", "20", "25"]),
    };
    if (rand() < 0.7) { data.gh = pick(["5", "6", "6", "7"]); data.kh = pick(["3", "3", "4"]); }
    if (wc) { data.waterChange = true; data.waterChangePct = pick(["30", "30", "40", "50"]); }
    let note = null;
    if (!spikeLogged && d <= 172) { spikeLogged = true; data.ammonia = "0.25"; data.nitrite = "0.25"; note = "Small spike after adding the rasboras. Dosed Prime."; }
    else if (data.waterChangePct === "50") { data.nitrate = "<5"; note = "Tested after a big change."; }
    entry(TANK_A, "parameters", d, pick(["18:45", "19:30", "20:10", "21:00"]), data, note);
  }
  // Latest test: logged the next evening for a morning test (created_at later than a
  // later-in-the-day observation) — exercises ORDER BY date, time, created_at.
  entry(TANK_A, "parameters", 2, "08:15",
    { temp: "77", ph: "6.8", ammonia: "0", nitrite: "0", nitrate: "15", gh: "6", kh: "3", waterChange: true, waterChangePct: "40" },
    "Morning test + 40% change (logged that evening).", `${dateAgo(2)} 21:10:00`);
  entry(TANK_A, "observations", 2, "19:40", {}, "Cory pygmies hovering mid-water in a loose school. Very cute.");
}

// Living Room 75g — plants/livestock
entry(TANK_A, "changes", 178, "14:00", { changeType: "Added", subject: "Cryptocoryne wendtii", quantity: "5" }, "Background left corner.");
entry(TANK_A, "changes", 177, "15:30", { changeType: "Added", subject: "Rotala rotundifolia", quantity: "10" }, "10 stems, back right.");
entry(TANK_A, "changes", 172, "17:00", { changeType: "Added", subject: "Harlequin rasbora", quantity: "12" }, "Acclimated ~1 hr by drip.");
entry(TANK_A, "changes", 165, "16:15", { changeType: "Added", subject: "Amano shrimp", quantity: "6" });
entry(TANK_A, "changes", 150, "18:20", { changeType: "Added", subject: "Otocinclus", quantity: "4" });
entry(TANK_A, "changes", 140, "19:00", { changeType: "Fertilized", subject: "Easy Green", quantity: "2 pumps" });
entry(TANK_A, "changes", 132, "08:05", { changeType: "Died", subject: "Otocinclus", quantity: "1" }, "Found near the filter intake. Others look fine.");
entry(TANK_A, "changes", 120, "20:30", { changeType: "Trimmed", subject: "Rotala rotundifolia" }, "Topped and replanted the tops.");
entry(TANK_A, "changes", 110, "19:10", { changeType: "Fertilized", subject: "Easy Green", quantity: "2 pumps" });
entry(TANK_A, "changes", 100, "13:45", { changeType: "Added", subject: "Monte Carlo", quantity: "2" }, "Two tissue-culture cups, foreground.");
entry(TANK_A, "changes", 95, "17:40", { changeType: "Added", subject: "Corydoras pygmaeus", quantity: "8" });
entry(TANK_A, "changes", 75, "19:25", { changeType: "Fertilized", subject: "Easy Green", quantity: "3 pumps" }, "Bumped dose — plants looking pale.");
entry(TANK_A, "changes", 60, "20:00", { changeType: "Trimmed", subject: "Rotala rotundifolia" });
entry(TANK_A, "changes", 45, "15:00", { changeType: "Added", subject: "Amano Shrimp", quantity: "3" }, "Second batch from the LFS.");
entry(TANK_A, "changes", 30, "19:15", { changeType: "Fertilized", subject: "Easy Green", quantity: "2 pumps" });
entry(TANK_A, "changes", 22, "07:50", { changeType: "Died", subject: "Harlequin rasbora", quantity: "1" }, "Old age? No visible symptoms.");
entry(TANK_A, "changes", 6, "19:05", { changeType: "Fertilized", subject: "Easy Green", quantity: "2 pumps" });

// Living Room 75g — observations
entry(TANK_A, "observations", 174, "21:15", {}, "Tank cycled — ammonia and nitrite at 0 for a week straight.");
entry(TANK_A, "observations", 158, "18:00", {}, "Rasboras schooling nicely along the front glass now.");
entry(TANK_A, "observations", 135, "20:20", {}, "Green spot algae starting on the front glass.");
entry(TANK_A, "observations", 101, "16:30", {}, "Rotala pearling like crazy an hour after lights on.");
entry(TANK_A, "observations", 65, "19:50", {}, "BBA on the driftwood. Spot-treated with Excel.");
entry(TANK_A, "observations", 33, "07:30", {}, "Cory eggs on the glass! Probably won't survive in a community tank.");
entry(TANK_A, "observations", 8, "20:40", {}, "Rotala tops turning red near the surface.");

// Living Room 75g — medical
entry(TANK_A, "medical", 128, "18:30", {
  fish: "Harlequin rasbora", count: "2",
  symptoms: "White spots on fins and body (ich)",
  treatment: "Raised temp to 82°F, Ich-X 5 mL / 10 gal daily",
  dateIn: dateAgo(128), dateOut: dateAgo(118),
  outcome: "Recovered — returned to display",
}, "Treated in the 5g hospital tank.");
entry(TANK_A, "medical", 5, "21:05", {
  fish: "Otocinclus", count: "1",
  symptoms: "Sunken belly, not grazing",
  treatment: "Repashy + blanched zucchini; fenbendazole-soaked food",
  dateIn: dateAgo(5),
  outcome: "Still in treatment",
});

// Living Room 75g — CO₂
entry(TANK_A, "co2", 175, "10:00", { status: "on", bubbleRate: "1", dropChecker: "blue", timerHours: "8", timerStart: "10:00", timerStop: "18:00" }, "Pressurized CO₂ installed. Solenoid on the light timer.");
entry(TANK_A, "co2", 168, "12:30", { status: "unchanged", bubbleRate: "2", dropChecker: "blue" });
entry(TANK_A, "co2", 160, "13:00", { status: "unchanged", bubbleRate: "2.5", dropChecker: "lime_green" }, "Drop checker finally lime.");
entry(TANK_A, "co2", 90, "17:45", { status: "off" }, "Cylinder empty — refill tomorrow.");
entry(TANK_A, "co2", 88, "11:20", { status: "on", bubbleRate: "2.5" }, "Refilled the 5 lb cylinder.");
entry(TANK_A, "co2", 50, "09:30", { status: "unchanged", timerHours: "7", timerStart: "11:00", timerStop: "18:00" }, "Shortened photoperiod to fight algae.");
entry(TANK_A, "co2", 20, "14:10", { status: "unchanged", dropChecker: "yellow" }, "Fish breathing hard at the surface. Turned it down.");
entry(TANK_A, "co2", 19, "14:00", { status: "unchanged", bubbleRate: "2", dropChecker: "lime_green" });

// Shrimp Cube 10g — parameters every ~10–14 days; water changes stop ~41 days ago.
{
  const LAST_WC = 41;
  const days = [];
  for (let d = 170; d > LAST_WC; d -= between(10, 14)) days.push(d);
  if (days[days.length - 1] !== LAST_WC) days.push(LAST_WC);
  days.push(28, 15, 4);
  let nitrate = 5;
  for (const d of days) {
    const wc = d >= LAST_WC;
    if (!wc) nitrate += 5;
    const data = {
      temp: pick(["72", "72.5", "73", "74"]),
      ph: pick(["7.2", "7.2", "7.4"]),
      ammonia: "0",
      nitrite: "0",
      nitrate: wc ? pick(["<5", "<5", "5", "10"]) : String(nitrate),
      gh: pick(["7", "8"]),
      kh: pick(["2", "3"]),
    };
    if (wc) { data.waterChange = true; data.waterChangePct = pick(["10", "15", "20"]); }
    entry(TANK_B, "parameters", d, pick(["20:15", "21:30"]), data,
      d === 4 ? "Nitrate creeping up. Need to do a water change this weekend." : null);
  }
}

// Shrimp Cube 10g — changes & observations
entry(TANK_B, "changes", 168, "16:00", { changeType: "Added", subject: "Cherry shrimp", quantity: "10" });
entry(TANK_B, "changes", 166, "16:30", { changeType: "Added", subject: "Nerite snail", quantity: "1" });
entry(TANK_B, "changes", 150, "20:00", { changeType: "Fertilized", subject: "Shrimp-safe fertilizer", quantity: "1 mL" });
entry(TANK_B, "changes", 140, "08:20", { changeType: "Died", subject: "Cherry shrimp", quantity: "2" }, "Failed molts? GH might be low.");
entry(TANK_B, "changes", 110, "15:15", { changeType: "Added", subject: "Red cherry shrimp", quantity: "5" }, "Different breeder, deeper red.");
entry(TANK_B, "changes", 80, "18:00", { changeType: "Added", subject: "Java moss" }, "Clump moved over from the 75g.");
entry(TANK_B, "changes", 60, "17:10", { changeType: "Added", subject: "amano shrimp", quantity: "2" });
entry(TANK_B, "changes", 18, "19:45", { changeType: "Trimmed", subject: "Java moss" });
entry(TANK_B, "observations", 155, "21:00", {}, "Berried female!");
entry(TANK_B, "observations", 125, "20:30", {}, "Baby shrimp visible on the moss.");
entry(TANK_B, "observations", 30, "21:20", {}, "Biofilm building up on the glass. Overdue for a water change.");
entry(TANK_B, "observations", 12, "20:05", {}, "Colony thriving — lots of juveniles.");

// ── Inhabitants (matching the change log, including near-duplicate names) ────

const inhabitants = [
  [TANK_A, "Cryptocoryne wendtii", 5, 178, "Slow grower, background left."],
  [TANK_A, "Rotala rotundifolia", null, 177, "Trim every ~4 weeks."],
  [TANK_A, "Harlequin rasbora", 11, 172, null],
  [TANK_A, "Amano shrimp", 6, 165, "Algae crew."],
  [TANK_A, "Otocinclus", 3, 150, "Supplement with Repashy."],
  [TANK_A, "Monte Carlo", 2, 100, null],
  [TANK_A, "Corydoras pygmaeus", 8, 95, null],
  [TANK_A, "Amano Shrimp", 3, 45, null],
  [TANK_B, "Cherry shrimp", 8, 168, null],
  [TANK_B, "Nerite snail", 1, 166, null],
  [TANK_B, "Red cherry shrimp", 5, 110, null],
  [TANK_B, "Java moss", null, 80, "From the 75g."],
  [TANK_B, "amano shrimp", 2, 60, null],
];

// ── SQL ─────────────────────────────────────────────────────────────────────

const demoHash = await hashPassword(PASSWORD);
const viewerHash = await hashPassword(PASSWORD);
const created = `${dateAgo(182)} 12:00:00`;

const sql = [];
sql.push(`-- Generated by scripts/seed-local.mjs on ${new Date().toISOString()} — synthetic local data only.`);

// Clean slate for the seed accounts (explicit deletes; don't rely on CASCADE).
const seedUsers = `(SELECT id FROM users WHERE email IN (${sq(DEMO_EMAIL)}, ${sq(VIEWER_EMAIL)}) OR username IN ('demo', 'viewer'))`;
const seedTanks = `(SELECT id FROM tanks WHERE user_id IN ${seedUsers})`;
sql.push(`DELETE FROM entries WHERE tank_id IN ${seedTanks};`);
sql.push(`DELETE FROM inhabitants WHERE tank_id IN ${seedTanks};`);
sql.push(`DELETE FROM tanks WHERE user_id IN ${seedUsers};`);
sql.push(`DELETE FROM sessions WHERE user_id IN ${seedUsers};`);
sql.push(`DELETE FROM password_resets WHERE user_id IN ${seedUsers};`);
sql.push(`DELETE FROM users WHERE id IN ${seedUsers};`);

sql.push(`INSERT INTO users (email, username, display_name, password_hash, created_at) VALUES
  (${sq(DEMO_EMAIL)}, 'demo', 'Demo Aquarist', ${sq(demoHash)}, ${sq(created)}),
  (${sq(VIEWER_EMAIL)}, 'viewer', 'Viewer', ${sq(viewerHash)}, ${sq(created)});`);

sql.push(`INSERT INTO tanks (user_id, name, description, slug, is_public, created_at, updated_at) VALUES
  (${userId(DEMO_EMAIL)}, ${sq(TANK_A)}, 'High-tech planted community tank, pressurized CO₂', '75planted', 1, ${sq(created)}, ${sq(created)}),
  (${userId(DEMO_EMAIL)}, ${sq(TANK_B)}, 'Neocaridina colony on the desk', NULL, 0, ${sq(created)}, ${sq(created)});`);

for (const [tank, name, count, daysAgo, notes] of inhabitants) {
  sql.push(`INSERT INTO inhabitants (tank_id, name, count, date_added, notes, created_at) VALUES (${tankId(tank)}, ${sq(name)}, ${count ?? "NULL"}, ${sq(dateAgo(daysAgo))}, ${sq(notes)}, ${sq(`${dateAgo(daysAgo)} 12:00:00`)});`);
}

entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
for (const e of entries) {
  sql.push(`INSERT INTO entries (tank_id, type, date, time, data, note, created_at) VALUES (${tankId(e.tank)}, ${sq(e.type)}, ${sq(e.date)}, ${sq(e.time)}, ${sq(JSON.stringify(e.data))}, ${sq(e.note)}, ${sq(e.createdAt)});`);
}

sql.push(...reminderSeedSql({ sq, userId, tankId, dateAgo, demoEmail: DEMO_EMAIL, tankA: TANK_A, tankB: TANK_B }));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, sql.join("\n") + "\n");

const byType = entries.reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {});
console.log(`Wrote ${OUT}`);
console.log(`  ${entries.length} entries ${JSON.stringify(byType)}, ${inhabitants.length} inhabitants, 2 tanks, 2 users`);

if (DRY_RUN) process.exit(0);

try {
  // stdout is a JSON result per statement — too noisy to show on success.
  execFileSync(
    resolve(ROOT, "node_modules/.bin/wrangler"),
    ["d1", "execute", DB_NAME, "--local", `--file=${OUT}`],
    { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024 }
  );
} catch (err) {
  if (err.stdout) process.stdout.write(err.stdout);
  console.error("\nSeeding failed (did you run `npm run db:migrate:local`?)");
  process.exit(1);
}

console.log(`\nSeeded local D1. Log in as ${DEMO_EMAIL} / ${PASSWORD}`);
