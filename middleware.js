import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// "/r/" + "/unsubscribe" + "/api/email/": signed-token reminder email links (no session needed).
// "/cal/": private calendar feeds (/cal/<token>.ics) — the unguessable token is the credential.
const PUBLIC_PAGE_PREFIXES = ["/login", "/register", "/reset-request", "/reset-password", "/t/", "/privacy", "/terms", "/goodbye", "/sitemap.xml", "/robots.txt", "/r/", "/unsubscribe", "/cal/"];
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/tanks/", "/api/species", "/api/email/"];
// Dev-only tooling (e.g. /dev/outbox). The pages themselves also 404 outside development.
const DEV_PAGE_PREFIXES = process.env.NODE_ENV === "development" ? ["/dev/", "/api/dev/"] : [];

// The old production hostname. Exact match only: preview deployments
// (<hash>.tank-journal.pages.dev) and localhost must keep working.
const LEGACY_HOST = "tank-journal.pages.dev";
const CANONICAL_ORIGIN = "https://aquaslog.com";

export default function middleware(request) {
  const { pathname, search } = request.nextUrl;

  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (host === LEGACY_HOST) {
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${pathname}${search}`, 301);
  }

  // Always allow public paths
  if (
    PUBLIC_PAGE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p)) ||
    DEV_PAGE_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Check for session cookie (presence only — validity is checked in route handlers)
  const sessionToken = request.cookies.get("session")?.value;

  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Forward the session token in a header so server components / route handlers
  // don't need to re-parse the cookie string manually.
  const headers = new Headers(request.headers);
  headers.set("x-session-token", sessionToken);
  return NextResponse.next({ request: { headers } });
}
