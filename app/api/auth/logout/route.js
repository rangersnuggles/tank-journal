export const runtime = "edge";

import { deleteSession, clearSessionCookie } from "@/lib/session";

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name) return v ?? null;
  }
  return null;
}

export async function POST(request) {
  const token = parseCookie(request.headers.get("cookie"), "session");
  if (token) {
    try {
      await deleteSession(token);
    } catch {
      // Ignore — cookie will still be cleared
    }
  }
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}
