import { redirect } from "next/navigation";

export const runtime = "edge";

// Root path: middleware handles unauthenticated users (redirects to /login).
// Authenticated users landing here go straight to their dashboard.
export default function RootPage() {
  redirect("/dashboard");
}
