"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const fontFamily = "'DM Sans', sans-serif";

const fish = `.            ,
           .:/
.      ,,///;,   ,;/
  .   o:::::::;;///
     >::::::::;;\\\\\\
       ''\\\\\\\\\\'" ';\\
          ';\\`;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {searchParams.get("reset") === "1" && (
        <p style={{ textAlign: "center", color: "#059669", fontSize: 13, marginBottom: 16, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px" }}>
          Password updated — sign in with your new password.
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && (
          <p style={{ color: "var(--color-error-text)", fontSize: 13, margin: 0 }}>{error}</p>
        )}
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", fontFamily }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <pre style={{ fontFamily: "monospace", fontSize: 10, color: "#9ca3af", textAlign: "center", margin: "0 0 8px", lineHeight: 1.4, whiteSpace: "pre" }}>{fish}</pre>
        <h1 style={{ fontFamily: "'VT323', monospace", fontSize: 48, fontWeight: 400, marginBottom: 8, textAlign: "center", color: "var(--color-text-primary)" }}>
          AquaSlog
        </h1>
        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 14, marginBottom: 32 }}>
          An Open Source Freshwater Aquarium Journal
        </p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 24 }}>
          No account?{" "}
          <Link href="/register" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
            Create one
          </Link>
        </p>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
          <Link href="/reset-request" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
            Forgot password?
          </Link>
        </p>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
          <Link href="/t/robrob/75planted" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
            See what it looks like →
          </Link>
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
