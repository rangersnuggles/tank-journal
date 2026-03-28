/**
 * Password hashing and session token generation.
 * Uses Web Crypto API (crypto.subtle) — fully edge-compatible, no bcrypt.
 *
 * Stored hash format: "100000:<saltBase64>:<derivedKeyBase64>"
 * Note: Cloudflare Workers caps PBKDF2 at 100,000 iterations.
 */

const ITERATIONS = 100_000;
const HASH = "SHA-256";
const KEY_LENGTH = 256; // bits

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEY_LENGTH
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
  return `${ITERATIONS}:${saltB64}:${hashB64}`;
}

export async function verifyPassword(password, storedHash) {
  const [iterStr, saltB64, expectedB64] = storedHash.split(":");
  const iterations = parseInt(iterStr, 10);
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: HASH },
    keyMaterial,
    KEY_LENGTH
  );
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
  return hashB64 === expectedB64;
}

export function generateSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
