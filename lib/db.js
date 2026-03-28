import { getRequestContext } from "@cloudflare/next-on-pages";

/**
 * Returns the D1 database binding.
 * Works in both Cloudflare Pages production and local `wrangler pages dev`.
 */
export function getDB() {
  return getRequestContext().env.DB;
}
