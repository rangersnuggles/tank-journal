"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Nav({ user }) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
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
        {user && (
          <span style={{ fontSize: "12px", color: "var(--color-text-subtle)" }}>
            {user.display_name || user.username}
          </span>
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
