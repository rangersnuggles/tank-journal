"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { SAMPLE_TANK_PATH } from "@/lib/site";

const sans = "'DM Sans', sans-serif";
const serif = "'Lora', serif";

const STEPS = [
  { n: 1, title: "Create your first tank", body: "Give it a name — you can keep it private or share a public page later." },
  { n: 2, title: "Log a water test", body: "Temp, pH, ammonia, nitrite, nitrate. One test is enough to start a history." },
  { n: 3, title: "Set up a water-change reminder", body: "Get a nudge when your next water change is due." },
];

const track = (step) => posthog.capture("onboarding_step_clicked", { step });

/** Dashboard empty state (user has zero tanks). */
export default function OnboardingEmptyState({ name }) {
  return (
    <div className="ob-card" style={{
      border: "1px solid var(--color-border)", borderRadius: "14px", background: "var(--color-surface)",
      padding: "28px 28px 24px", fontFamily: sans, maxWidth: "620px", margin: "8px auto 0",
    }}>
      <style>{`
        .ob-primary:hover { opacity: 0.85; }
        @media (max-width: 600px) { .ob-card { padding: 22px 18px 20px !important; } }
      `}</style>
      <h2 style={{ fontFamily: serif, fontSize: "21px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 6px" }}>
        Welcome{name ? `, ${name}` : ""} — let’s set up your tank journal
      </h2>
      <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 22px", lineHeight: 1.55 }}>
        Three quick steps and you’ll have a running history of your aquarium.
      </p>

      <ol style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {STEPS.map((s) => {
          const current = s.n === 1;
          return (
            <li key={s.n} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{
                flexShrink: 0, width: "26px", height: "26px", borderRadius: "50%", display: "inline-flex",
                alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600,
                background: current ? "var(--color-accent)" : "transparent",
                color: current ? "#fff" : "var(--color-text-subtle)",
                border: current ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
              }}>{s.n}</span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 500, color: current ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>{s.title}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-subtle)", lineHeight: 1.5, marginTop: "2px" }}>{s.body}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
        <Link href="/tanks/new" className="ob-primary" onClick={() => track("create_first_tank")} style={{
          background: "var(--color-accent)", color: "#fff", textDecoration: "none",
          borderRadius: "7px", padding: "10px 18px", fontSize: "14px", fontWeight: 500,
        }}>Create your first tank</Link>
        <Link href={SAMPLE_TANK_PATH} onClick={() => track("view_sample_tank")} style={{
          color: "var(--color-accent)", textDecoration: "none", fontSize: "13px",
        }}>See an example tank →</Link>
      </div>
    </div>
  );
}
