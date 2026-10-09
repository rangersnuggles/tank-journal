"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";

const sansFamily  = "'DM Sans', sans-serif";
const serifFamily = "'Lora', serif";

const inputStyle = {
  padding: "9px 12px", border: "1px solid var(--color-border)", borderRadius: "6px",
  fontSize: "14px", background: "var(--color-input-bg)", color: "var(--color-input-text)",
  outline: "none", width: "100%", boxSizing: "border-box", fontFamily: sansFamily,
};

const hintStyle = { fontSize: "11px", color: "var(--color-text-subtle)", lineHeight: 1.5 };

/** "75g Planted Tank!" → "75g-planted-tank" (matches the API's [a-z0-9_-] rule). */
function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function NewTankForm() {
  const router = useRouter();
  const welcome = useSearchParams().get("welcome") === "1";
  // New tanks are private by default; a public page is opt-in.
  const [form, setForm] = useState({ name: "", description: "", slug: "", is_public: false });
  const [slugTouched, setSlugTouched] = useState(false);
  const [username, setUsername] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Username is only used to preview the public URL.
  useEffect(() => {
    fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).then(u => u && setUsername(u.username)).catch(() => {});
  }, []);

  function setName(e) {
    const name = e.target.value;
    setForm(f => ({ ...f, name, slug: f.is_public && !slugTouched ? slugify(name) : f.slug }));
  }

  function togglePublic(e) {
    const is_public = e.target.checked;
    setForm(f => ({ ...f, is_public, slug: is_public && !slugTouched ? slugify(f.name) : f.slug }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/tanks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A slug only matters for public tanks.
        body: JSON.stringify({ ...form, slug: form.is_public ? form.slug : "" }),
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
    <div style={{ maxWidth: "520px", width: "100%", margin: "60px auto", padding: "0 24px", fontFamily: sansFamily }}>
      <Link href="/dashboard" style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none", display: "block", marginBottom: "24px" }}>← Dashboard</Link>

      {welcome && (
        <div style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info-border)", color: "var(--color-info-text)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "20px", lineHeight: 1.5 }}>
          Welcome to AquaSlog! Step 1 of 3: create your first tank. Next you’ll log a water test.
        </div>
      )}

      <h1 style={{ fontFamily: serifFamily, fontSize: "24px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 28px" }}>
        {welcome ? "Create your first tank" : "New Tank"}
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Tank name *</span>
          <input type="text" placeholder="e.g. Living Room 75g, Shrimp Cube, Betta Nano" value={form.name} onChange={setName} required maxLength={80} autoFocus style={inputStyle} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Description</span>
          <input type="text" placeholder="e.g. 75-gallon planted tank, CO₂, community fish" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={200} style={inputStyle} />
          <span style={hintStyle}>Size, style, and what lives in it. Optional — you can change it later in Settings.</span>
        </label>

        <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0, fontWeight: 500 }}>Visibility</p>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_public} onChange={togglePublic} style={{ width: "15px", height: "15px", marginTop: "2px", accentColor: "#0891b2", flexShrink: 0 }} />
            <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Share a public, read-only page for this tank</span>
              <span style={hintStyle}>
                {form.is_public
                  ? "Anyone with the link can view this tank’s journal and inhabitants (read only), and it may appear in search engines. Your email is never shown. You can turn this off any time in Settings."
                  : "Private by default — only you can see this tank. Turn this on to get a shareable link to a read-only page of your journal."}
              </span>
            </span>
          </label>

          {form.is_public && (
            <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Public URL slug</span>
              <input type="text" placeholder="e.g. living-room-75g" value={form.slug}
                onChange={e => { setSlugTouched(true); setForm(f => ({ ...f, slug: e.target.value })); }}
                required pattern="[a-zA-Z0-9_\-]+" title="Letters, numbers, hyphens, underscores only" style={inputStyle} />
              <span style={hintStyle}>
                {form.slug
                  ? <>Your public page: <span style={{ color: "var(--color-text-muted)", wordBreak: "break-all" }}>aquaslog.com/t/{username || "your-username"}/{form.slug.toLowerCase()}</span></>
                  : "Letters, numbers, hyphens and underscores."}
              </span>
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

export default function NewTankPage() {
  return (
    <Suspense fallback={null}>
      <NewTankForm />
    </Suspense>
  );
}
