import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const PUBLIC_PAGE_PREFIXES = ["/login", "/register", "/t/"];
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/debug", "/api/tanks/"];

export default function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (
    PUBLIC_PAGE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
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
