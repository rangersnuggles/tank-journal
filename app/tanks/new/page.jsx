"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const sansFamily  = "'DM Sans', sans-serif";
const serifFamily = "'Lora', serif";

const inputStyle = {
  padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: "6px",
  fontSize: "14px", background: "#fafafa", color: "#1e293b",
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
      router.push(`/tanks/${tank.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: "520px", margin: "60px auto", padding: "0 24px", fontFamily: sansFamily }}>
      <Link href="/dashboard" style={{ fontSize: "12px", color: "#94a3b8", textDecoration: "none", display: "block", marginBottom: "24px" }}>← Dashboard</Link>

      <h1 style={{ fontFamily: serifFamily, fontSize: "24px", fontWeight: 400, color: "#0f172a", margin: "0 0 28px" }}>New Tank</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Tank name *</span>
          <input type="text" placeholder="e.g. 75g Planted" value={form.name} onChange={set("name")} required style={inputStyle} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Description</span>
          <input type="text" placeholder="e.g. Freshwater planted, low tech" value={form.description} onChange={set("description")} style={inputStyle} />
        </label>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0, fontWeight: 500 }}>Public visibility</p>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_public} onChange={set("is_public")} style={{ width: "15px", height: "15px", accentColor: "#0891b2" }} />
            <span style={{ fontSize: "13px", color: "#334155" }}>Make this tank publicly viewable</span>
          </label>

          {form.is_public && (
            <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Public URL slug</span>
              <input
                type="text"
                placeholder="e.g. 75g-planted"
                value={form.slug}
                onChange={set("slug")}
                pattern="[a-zA-Z0-9_\-]+"
                title="Letters, numbers, hyphens, underscores only"
                style={inputStyle}
              />
              {form.slug && <span style={{ fontSize: "11px", color: "#94a3b8" }}>Public URL: /t/your-username/{form.slug}</span>}
            </label>
          )}
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: "13px", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingTop: "8px" }}>
          <Link href="/dashboard" style={{ padding: "9px 16px", fontSize: "13px", color: "#64748b", textDecoration: "none", border: "1px solid #e2e8f0", borderRadius: "6px" }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{
            padding: "9px 20px", background: "#0891b2", color: "#fff", border: "none",
            borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
            opacity: saving ? 0.6 : 1, fontFamily: sansFamily,
          }}>{saving ? "Creating…" : "Create Tank"}</button>
        </div>
      </form>
    </div>
  );
}
