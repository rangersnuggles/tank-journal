"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Nav({ user }) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div style={{
      borderBottom: "1px solid #f1f5f9",
      padding: "10px 24px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: "'DM Sans', sans-serif",
      background: "#fff",
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      <Link href="/dashboard" style={{ fontFamily: "'Lora', serif", fontSize: "15px", color: "#0f172a", textDecoration: "none", fontWeight: 400 }}>
        Aqua Slog
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {user && (
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
            {user.display_name || user.username}
          </span>
        )}
        <button
          onClick={handleSignOut}
          style={{ fontSize: "12px", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
