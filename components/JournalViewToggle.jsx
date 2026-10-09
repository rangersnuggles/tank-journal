"use client";
/** "Journal | Trends" switch shown beside the entry-type filter pills. */

const VIEWS = [
  ["journal", "Journal"],
  ["trends", "Trends"],
];

export default function JournalViewToggle({ view, onChange }) {
  return (
    <div role="tablist" aria-label="Tank view" style={{
      display: "inline-flex", gap: "2px", padding: "2px", borderRadius: "20px",
      border: "1px solid var(--color-border)", marginRight: "6px",
    }}>
      {VIEWS.map(([key, label]) => {
        const on = view === key;
        return (
          <button key={key} type="button" role="tab" aria-selected={on} onClick={() => onChange(key)} style={{
            padding: "2px 11px", borderRadius: "16px", fontSize: "11px", border: "none", cursor: "pointer",
            fontWeight: on ? 600 : 400, fontFamily: "'DM Sans', sans-serif",
            background: on ? "var(--color-filter-active-bg)" : "transparent",
            color: on ? "var(--color-filter-active-text)" : "var(--color-text-muted)",
          }}>{label}</button>
        );
      })}
    </div>
  );
}
