"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { identifyUser, resetAnalytics } from "@/lib/analytics";

export default function Nav({ user }) {
  const router = useRouter();
  const userId = user?.user_id ?? user?.id;

  // Any page with a signed-in Nav knows the session: tie analytics to the opaque id.
  useEffect(() => {
    if (userId != null) identifyUser(userId);
  }, [userId]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    resetAnalytics();
    router.push("/login");
    router.refresh();
  }

  return (
    <div style={{
      borderBottom: "1px solid var(--color-nav-border)",
      padding: "10px 24px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: "'DM Sans', sans-serif",
      background: "var(--color-nav-bg)",
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      <Link href="/dashboard" style={{ fontFamily: "'VT323', monospace", fontSize: "22px", color: "var(--color-text-primary)", textDecoration: "none" }}>
        AquaSlog
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* ph-no-capture keeps the display name out of PostHog autocapture ($el_text). */}
        {user && (
          <Link href="/account" title="Account settings" className="ph-no-capture" style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none" }}>
            {user.display_name || user.username}
          </Link>
        )}
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          style={{ fontSize: "12px", color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
