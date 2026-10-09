"use client";

import posthog from "posthog-js";

const sans = "'DM Sans', sans-serif";

// The most common first entries. `preset` prefills the entry form.
const QUICK_STARTS = [
  {
    step: "first_entry_parameters", type: "parameters", preset: {},
    icon: "◎", color: "#0891b2", label: "Log a water test",
    hint: "Temp, pH, ammonia, nitrite, nitrate… tick “Water change” if you did one.",
  },
  {
    step: "first_entry_livestock", type: "changes", preset: { changeType: "Added" },
    icon: "⬡", color: "#059669", label: "Add plants or livestock",
    hint: "Fish, shrimp, snails or plants — they’ll appear in your Inhabitants list.",
  },
  {
    step: "first_entry_observation", type: "observations", preset: {},
    icon: "◈", color: "#7c3aed", label: "Write an observation",
    hint: "Anything you noticed today: algae, behaviour, a new plant leaf.",
  },
];

/**
 * Shown on the owner's tank page while the journal has no entries.
 * `onStart(type, preset)` opens TankJournal's entry form preselected.
 */
export default function GettingStarted({ tankName, onStart }) {
  return (
    <div style={{
      margin: "20px 0 0", padding: "22px 22px 20px", border: "1px solid var(--color-border)",
      borderRadius: "12px", background: "var(--color-surface)", fontFamily: sans, animation: "fadeIn 0.2s ease",
    }}>
      <style>{`
        .gs-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        @media (max-width: 760px) { .gs-grid { grid-template-columns: 1fr; } }
        .gs-btn:hover { border-color: var(--color-accent) !important; }
      `}</style>
      <div style={{ fontFamily: "'Lora', serif", fontSize: "18px", color: "var(--color-text-primary)", marginBottom: "4px" }}>
        {tankName ? `${tankName} is ready` : "Your journal is ready"}
      </div>
      <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Start with your first entry. A quick water test is the most useful place to begin — every entry builds the history you’ll look back on.
      </p>
      <div className="gs-grid">
        {QUICK_STARTS.map((q) => (
          <button
            key={q.step}
            type="button"
            className="gs-btn"
            onClick={() => {
              posthog.capture("onboarding_step_clicked", { step: q.step });
              onStart(q.type, q.preset);
            }}
            style={{
              textAlign: "left", cursor: "pointer", background: "var(--color-bg)",
              border: "1px solid var(--color-border)", borderRadius: "9px", padding: "12px 14px",
              fontFamily: sans, display: "flex", flexDirection: "column", gap: "4px",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 500, color: q.color }}>{q.icon} {q.label}</span>
            <span style={{ fontSize: "11px", color: "var(--color-text-subtle)", lineHeight: 1.45 }}>{q.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
