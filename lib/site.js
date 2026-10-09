/**
 * Site-wide constants shared by metadata, sitemap/robots and onboarding links.
 */

/** Canonical origin (no trailing slash). Used for canonical URLs, Open Graph and the sitemap. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://aquaslog.com").replace(/\/+$/, "");

/**
 * Public tank shown to curious visitors ("Check out a live tank").
 * Local seed data lives at /t/demo/75planted — set NEXT_PUBLIC_SAMPLE_TANK_PATH in .env.local.
 */
export const SAMPLE_TANK_PATH = process.env.NEXT_PUBLIC_SAMPLE_TANK_PATH || "/t/robrob/75planted";
