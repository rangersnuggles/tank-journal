/**
 * Re-hash a user's password with 100k iterations (Cloudflare Workers compatible)
 * and update it in D1.
 *
 * Usage:
 *   node scripts/rehash-password.mjs <email> <password>
 *
 * Example:
 *   node scripts/rehash-password.mjs rob@example.com mypassword
 */

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/rehash-password.mjs <email> <password>");
  process.exit(1);
}

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

const sql = `UPDATE users SET password_hash = '${passwordHash}' WHERE email = '${email.toLowerCase()}';`;
console.log("\nRunning update against D1 (--remote)...\n");

import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpPath = resolve(__dirname, "__rehash_tmp.sql");
writeFileSync(tmpPath, sql, "utf8");

try {
  execSync(`npx wrangler d1 execute tank-journal-db --file="${tmpPath}" --remote`, {
    stdio: "inherit",
    cwd: resolve(__dirname, ".."),
  });
  console.log("\n✓ Password updated! You can now log in with your new password.");
} finally {
  unlinkSync(tmpPath);
}
