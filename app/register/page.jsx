"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import Link from "next/link";

const fontFamily = "'DM Sans', sans-serif";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", username: "", display_name: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        return;
      }
      posthog.capture("signed_up");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", fontFamily }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <h1 style={{ fontFamily: "'VT323', monospace", fontSize: 48, fontWeight: 400, marginBottom: 8, textAlign: "center", color: "var(--color-text-primary)" }}>
          AquaSlog
        </h1>
        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 14, marginBottom: 32 }}>
          Create your account
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="email" placeholder="Email" value={form.email} onChange={set("email")} required style={inputStyle} />
          <input type="text" placeholder="Username (letters, numbers, hyphens)" value={form.username} onChange={set("username")} required pattern="[a-zA-Z0-9_\-]+" title="Letters, numbers, hyphens, and underscores only" style={inputStyle} />
          <input type="text" placeholder="Display name (optional)" value={form.display_name} onChange={set("display_name")} style={inputStyle} />
          <input type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set("password")} required minLength={8} style={inputStyle} />
          {error && <p style={{ color: "var(--color-error-text)", fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 24 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "10px 12px",
  border: "1px solid var(--color-border-faint)",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  background: "var(--color-input-bg)",
  color: "var(--color-input-text)",
};

const btnStyle = {
  padding: "11px 16px",
  background: "var(--color-btn-dark-bg)",
  color: "var(--color-btn-dark-text)",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
  fontWeight: 500,
};
