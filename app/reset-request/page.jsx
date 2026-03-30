"use client";

import { useState } from "react";
import Link from "next/link";

const fontFamily = "'DM Sans', sans-serif";

export default function ResetRequestPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }
      setDone(true);
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

        {done ? (
          <>
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 14, marginBottom: 8 }}>
              If that email is registered you'll get a reset link shortly.
            </p>
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 24 }}>
              <Link href="/login" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 14, marginBottom: 32 }}>
              Enter your email and we'll send a reset link.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
              {error && <p style={{ color: "var(--color-error-text)", fontSize: 13, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 24 }}>
              <Link href="/login" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Back to sign in</Link>
            </p>
          </>
        )}
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
