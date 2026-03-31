"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";

const sansFamily  = "'DM Sans', sans-serif";
const serifFamily = "'Lora', serif";

const inputStyle = {
  padding: "9px 12px", border: "1px solid var(--color-border)", borderRadius: "6px",
  fontSize: "14px", background: "var(--color-input-bg)", color: "var(--color-input-text)",
  outline: "none", width: "100%", boxSizing: "border-box", fontFamily: sansFamily,
};

export default function NewTankPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", slug: "", is_public: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: field === "is_public" ? e.target.checked : e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/tanks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create tank");
        return;
      }
      const tank = await res.json();
      posthog.capture("tank_created", { is_public: form.is_public });
      router.push(`/tanks/${tank.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: "520px", margin: "60px auto", padding: "0 24px", fontFamily: sansFamily }}>
      <Link href="/dashboard" style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none", display: "block", marginBottom: "24px" }}>← Dashboard</Link>

      <h1 style={{ fontFamily: serifFamily, fontSize: "24px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 28px" }}>New Tank</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Tank name *</span>
          <input type="text" placeholder="e.g. 75g Planted" value={form.name} onChange={set("name")} required style={inputStyle} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Description</span>
          <input type="text" placeholder="e.g. Freshwater planted, low tech" value={form.description} onChange={set("description")} style={inputStyle} />
        </label>

        <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0, fontWeight: 500 }}>Public visibility</p>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_public} onChange={set("is_public")} style={{ width: "15px", height: "15px", accentColor: "#0891b2" }} />
            <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Make this tank publicly viewable</span>
          </label>

          {form.is_public && (
            <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Public URL slug</span>
              <input type="text" placeholder="e.g. 75g-planted" value={form.slug} onChange={set("slug")} pattern="[a-zA-Z0-9_\-]+" title="Letters, numbers, hyphens, underscores only" style={inputStyle} />
              {form.slug && <span style={{ fontSize: "11px", color: "var(--color-text-subtle)" }}>Public URL: /t/your-username/{form.slug}</span>}
            </label>
          )}
        </div>

        {error && <p style={{ color: "var(--color-error-text)", fontSize: "13px", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingTop: "8px" }}>
          <Link href="/dashboard" style={{ padding: "9px 16px", fontSize: "13px", color: "var(--color-text-muted)", textDecoration: "none", border: "1px solid var(--color-border)", borderRadius: "6px" }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{
            padding: "9px 20px", background: "var(--color-accent)", color: "#fff", border: "none",
            borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
            opacity: saving ? 0.6 : 1, fontFamily: sansFamily,
          }}>{saving ? "Creating…" : "Create Tank"}</button>
        </div>
      </form>
    </div>
  );
}
