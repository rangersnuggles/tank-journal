"use client";

import { serifFamily } from "@/components/formStyles";

export function Section({ id, title, description, tone, children }) {
  return (
    <section
      id={id}
      style={{
        borderTop: `1px solid ${tone === "danger" ? "var(--color-danger-border)" : "var(--color-border-subtle)"}`,
        padding: "28px 0",
        scrollMarginTop: "64px",
      }}
    >
      <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
        {title}
      </h2>
      {description && (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 18px", lineHeight: 1.55 }}>{description}</p>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: "11px", color: "var(--color-text-subtle)", lineHeight: 1.5 }}>{hint}</span>}
    </label>
  );
}

export function Status({ error, success }) {
  if (error) return <p role="alert" style={{ color: "var(--color-error-text)", fontSize: "13px", margin: 0 }}>{error}</p>;
  if (success) return <p role="status" style={{ color: "var(--color-success-text)", fontSize: "13px", margin: 0 }}>{success}</p>;
  return null;
}
