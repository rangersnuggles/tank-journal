"use client";

export const runtime = "edge";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const sansFamily  = "'DM Sans', sans-serif";
const serifFamily = "'Lora', serif";

const inputStyle = {
  padding: "9px 12px", border: "1px solid var(--color-border)", borderRadius: "6px",
  fontSize: "14px", background: "var(--color-input-bg)", color: "var(--color-input-text)",
  outline: "none", width: "100%", boxSizing: "border-box", fontFamily: sansFamily,
};

export default function TankSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const tankId = params.tankId;

  const [form, setForm]     = useState({ name: "", description: "", slug: "", is_public: false });
  const [username, setUsername] = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tanks/${tankId}`).then(r => r.json()),
      fetch("/api/auth/me").then(r => r.json()),
    ]).then(([tank, user]) => {
      setForm({
        name: tank.name || "",
        description: tank.description || "",
        slug: tank.slug || "",
        is_public: !!tank.is_public,
      });
      setUsername(user.username || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tankId]);

  function set(field) {
    return (e) => {
      setSuccess(false);
      setForm(f => ({ ...f, [field]: field === "is_public" ? e.target.checked : e.target.value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/tanks/${tankId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save changes");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this tank and ALL its entries? This cannot be undone.")) return;
    const res = await fetch(`/api/tanks/${tankId}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
    else setError("Failed to delete tank.");
  }

  if (loading) {
    return <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--color-text-subtle)", fontFamily: sansFamily }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: "520px", margin: "60px auto", padding: "0 24px", fontFamily: sansFamily }}>
      <Link href={`/tanks/${tankId}`} style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none", display: "block", marginBottom: "24px" }}>← Back to journal</Link>

      <h1 style={{ fontFamily: serifFamily, fontSize: "24px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 28px" }}>Tank Settings</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Tank name *</span>
          <input type="text" value={form.name} onChange={set("name")} required style={inputStyle} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Description</span>
          <input type="text" value={form.description} onChange={set("description")} style={inputStyle} />
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
              <input type="text" value={form.slug} onChange={set("slug")} pattern="[a-zA-Z0-9_\-]+" title="Letters, numbers, hyphens, underscores only" style={inputStyle} />
              {form.slug && username && (
                <span style={{ fontSize: "11px", color: "var(--color-text-subtle)" }}>
                  Public URL: /t/{username}/{form.slug}
                </span>
              )}
            </label>
          )}
        </div>

        {error && <p style={{ color: "var(--color-error-text)", fontSize: "13px", margin: 0 }}>{error}</p>}
        {success && <p style={{ color: "var(--color-success-text)", fontSize: "13px", margin: 0 }}>Changes saved.</p>}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingTop: "8px" }}>
          <button type="submit" disabled={saving} style={{
            padding: "9px 20px", background: "var(--color-accent)", color: "#fff", border: "none",
            borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
            opacity: saving ? 0.6 : 1, fontFamily: sansFamily,
          }}>{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>

      <div style={{ borderTop: "1px solid var(--color-danger-border)", marginTop: "48px", paddingTop: "24px" }}>
        <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "12px", fontWeight: 500 }}>Danger zone</p>
        <button
          onClick={handleDelete}
          style={{ fontSize: "13px", color: "var(--color-danger-btn-text)", background: "none", border: "1px solid var(--color-danger-btn-border)", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontFamily: sansFamily }}
        >
          Delete this tank…
        </button>
      </div>
    </div>
  );
}
