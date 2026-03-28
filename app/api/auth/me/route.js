export const runtime = "edge";

import { getSession } from "@/lib/session";

export async function GET(request) {
  const user = await getSession(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    id: user.user_id,
    email: user.email,
    username: user.username,
    display_name: user.display_name,
  });
}
