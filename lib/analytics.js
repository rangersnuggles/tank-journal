/**
 * PostHog wrapper (client components only).
 *
 * Privacy rules:
 *  - Analytics are pseudonymous: we identify with the opaque numeric user id
 *    only — never email, username or display name.
 *  - Browser "Do Not Track" / Global Privacy Control => PostHog is never loaded
 *    (respect_dnt is also set as a second line of defence).
 *  - The ?token= of password-reset links is masked out of captured URLs.
 *  - Everything no-ops when NEXT_PUBLIC_POSTHOG_KEY is unset (local dev).
 */
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// URL query parameters that must never reach analytics.
const SENSITIVE_URL_PARAMS = ["token"];

/**
 * Browser privacy signals. posthog's own respect_dnt only stops *events*; it still
 * loads remote config and feature flags (which carry the distinct id), so when
 * the visitor asks not to be tracked we don't initialise PostHog at all.
 */
function privacySignal() {
  try {
    const nav = window.navigator || {};
    return (
      nav.doNotTrack === "1" ||
      nav.doNotTrack === "yes" ||
      window.doNotTrack === "1" ||
      nav.msDoNotTrack === "1" ||
      nav.globalPrivacyControl === true
    );
  } catch {
    return false;
  }
}

function enabled() {
  return typeof window !== "undefined" && !!KEY && KEY !== "REPLACE_ME" && !privacySignal();
}

/** Idempotent; safe to call from any effect. Returns true when PostHog is live. */
export function initAnalytics() {
  if (!enabled()) return false;
  if (!posthog.__loaded) {
    posthog.init(KEY, {
      api_host: HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
      respect_dnt: true,
      mask_personal_data_properties: true,
      custom_personal_data_properties: SENSITIVE_URL_PARAMS,
    });
  }
  return true;
}

/** Link this browser to the signed-in user (opaque id only). */
export function identifyUser(userId) {
  if (userId == null || !initAnalytics()) return;
  const id = String(userId);
  if (posthog.get_distinct_id() !== id) posthog.identify(id);
}

/** Forget the identified user (sign out, account deletion). */
export function resetAnalytics() {
  if (enabled() && posthog.__loaded) posthog.reset();
}

/** Strip sensitive query params from a URL before sending it ourselves. */
export function sanitizeUrl(url) {
  try {
    const u = new URL(url);
    for (const p of SENSITIVE_URL_PARAMS) {
      if (u.searchParams.has(p)) u.searchParams.set(p, "<MASKED>");
    }
    return u.toString();
  } catch {
    return url;
  }
}
