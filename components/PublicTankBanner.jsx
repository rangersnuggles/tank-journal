"use client";

import Link from "next/link";
import posthog from "posthog-js";
import ThemeToggle from "./ThemeToggle";

const sans = "'DM Sans', sans-serif";
const CTA_LABEL = "Start your own free tank journal →";

function trackCta(placement, tank) {
  posthog.capture("public_cta_clicked", { placement, tank_owner: tank.username, tank_slug: tank.slug });
}

/**
 * Top bar for public tank pages (/t/:username/:slug). Replaces TankJournal's default
 * read-only bar. `viewer` is "anonymous" | "owner" | "member" (logged in, not the owner).
 */
export default function PublicTankBanner({ tank, viewer = "anonymous" }) {
  return (
    <div className="pt-banner" style={{
      background: "var(--color-info-bg)", borderBottom: "1px solid var(--color-info-border)",
      padding: "9px 24px", fontSize: "12px", color: "var(--color-info-text)", fontFamily: sans,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap",
    }}>
      <style>{`
        .pt-cta:hover { opacity: 0.85; }
        @media (max-width: 600px) {
          .pt-banner { padding: 9px 16px !important; }
          .pt-banner-actions { width: 100%; justify-content: space-between; }
        }
      `}</style>
      <span style={{ lineHeight: 1.5 }}>
        <Link href={viewer === "anonymous" ? "/login" : "/dashboard"} style={{ fontFamily: "'VT323', monospace", fontSize: "17px", color: "var(--color-info-text)", textDecoration: "none", marginRight: "6px" }}>AquaSlog</Link>
        <strong>{tank.name}</strong>{tank.ownerName ? ` by ${tank.ownerName}` : ""}
        <span> — a public aquarium journal kept with AquaSlog</span>
      </span>
      <span className="pt-banner-actions" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {viewer === "anonymous" && (
          <Link href="/register" className="pt-cta" onClick={() => trackCta("banner", tank)} style={{
            background: "var(--color-accent)", color: "#fff", textDecoration: "none",
            borderRadius: "6px", padding: "5px 12px", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
          }}>{CTA_LABEL}</Link>
        )}
        {viewer === "owner" && (
          <Link href={`/tanks/${tank.id}`} style={{ color: "var(--color-info-text)", fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" }}>
            This is your public page · Open journal →
          </Link>
        )}
        {viewer === "member" && (
          <Link href="/dashboard" style={{ color: "var(--color-info-text)", textDecoration: "none", whiteSpace: "nowrap" }}>
            Your tanks →
          </Link>
        )}
        <ThemeToggle />
      </span>
    </div>
  );
}

/** Footer card shown below a public journal to logged-out visitors. */
export function PublicTankFooterCta({ tank }) {
  return (
    <div style={{ maxWidth: "1060px", margin: "0 auto", padding: "0 24px 56px", width: "100%" }}>
      <div style={{
        border: "1px solid var(--color-border)", background: "var(--color-surface)", borderRadius: "12px",
        padding: "22px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "16px", flexWrap: "wrap", fontFamily: sans,
      }}>
        <div style={{ minWidth: "220px", flex: "1 1 320px" }}>
          <div style={{ fontFamily: "'Lora', serif", fontSize: "18px", color: "var(--color-text-primary)", marginBottom: "4px" }}>
            Keep a journal like {tank.ownerName ? `${tank.ownerName}'s` : "this one"}
          </div>
          <div style={{ fontSize: "13px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Log water tests, livestock, plants, CO₂ and treatments in one place. Free and open source — keep it private or share it like this page.
          </div>
        </div>
        <Link href="/register" className="pt-cta" onClick={() => trackCta("footer", tank)} style={{
          background: "var(--color-accent)", color: "#fff", textDecoration: "none",
          borderRadius: "7px", padding: "10px 18px", fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap",
        }}>{CTA_LABEL}</Link>
      </div>
    </div>
  );
}
