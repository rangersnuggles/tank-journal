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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf9", fontFamily }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <h1 style={{ fontFamily: "'VT323', monospace", fontSize: 48, fontWeight: 400, marginBottom: 8, textAlign: "center", color: "#1a1a1a" }}>
          AquaSlog
        </h1>

        {done ? (
          <>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14, marginBottom: 8 }}>
              If that email is registered you'll get a reset link shortly.
            </p>
            <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 24 }}>
              <Link href="/login" style={{ color: "#0891b2", textDecoration: "none" }}>Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14, marginBottom: 32 }}>
              Enter your email and we'll send a reset link.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              {error && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 24 }}>
              <Link href="/login" style={{ color: "#0891b2", textDecoration: "none" }}>Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const btnStyle = {
  padding: "11px 16px",
  background: "#1a1a1a",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
  fontWeight: 500,
};
