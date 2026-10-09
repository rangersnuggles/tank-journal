/**
 * Shared account-field validation, used by registration and /account.
 * Each *Error() helper returns an error message string, or null when valid.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const DISPLAY_NAME_MAX_LENGTH = 80;

// Usernames appear in public URLs (/t/:username/:slug), so they must be URL-safe.
const USERNAME_RE = /^[a-z0-9_-]+$/i;
// Deliberately loose: one "@", something on each side, a dot in the domain, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function usernameError(username) {
  if (!username) return "Username is required";
  if (!USERNAME_RE.test(username)) {
    return "Username may only contain letters, numbers, hyphens, and underscores";
  }
  return null;
}

export function emailError(email) {
  if (!email) return "Email is required";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address";
  return null;
}

export function passwordError(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  return null;
}

export function displayNameError(displayName) {
  if (String(displayName ?? "").length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`;
  }
  return null;
}
