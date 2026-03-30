"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const fontFamily = "'DM Sans', sans-serif";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <p style={{ textAlign: "center", color: "var(--color-error-text)", fontSize: 14 }}>
        Invalid reset link.{" "}
        <Link href="/reset-request" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Request a new one</Link>
      </p>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.push("/login?reset=1");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={inputStyle} />
      <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={inputStyle} />
      {error && <p style={{ color: "var(--color-error-text)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button type="submit" disabled={loading} style={btnStyle}>
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", fontFamily }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <h1 style={{ fontFamily: "'VT323', monospace", fontSize: 48, fontWeight: 400, marginBottom: 8, textAlign: "center", color: "var(--color-text-primary)" }}>
          AquaSlog
        </h1>
        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 14, marginBottom: 32 }}>
          Choose a new password
        </p>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 24 }}>
          <Link href="/login" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Back to sign in</Link>
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
