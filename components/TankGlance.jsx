"use client";
/**
 * "At a glance" strip above the journal: latest water readings (with trend arrows and
 * a quiet high/low flag against the typical ranges in lib/params.js), when the water was
 * last tested and changed, current CO₂ state, and anything in treatment.
 *
 * Lives in the journal column rather than the sidebar so the sidebar can stay short
 * (reminders + inhabitants) at laptop widths. Renders nothing for an empty tank.
 */
import { useEffect, useMemo, useState } from "react";
import { PARAM_META, readingsFor, rangeStatus, formatTypical } from "@/lib/params";
import { localDateStr } from "@/lib/dates";
import { diffDays, fmtAgo } from "@/lib/reminders/dates";
import { lastDoneFromEntries } from "@/lib/reminders/match";

const sans = "'DM Sans', sans-serif";

function trend(latest, prev) {
  if (!prev) return null;
  const d = latest.value - prev.value;
  const eps = Math.max(Math.abs(prev.value), 1) * 1e-6;
  if (d > eps) return { arrow: "↑", word: "up" };
  if (d < -eps) return { arrow: "↓", word: "down" };
  return { arrow: "→", word: "unchanged" };
}

const rowLabel = { fontFamily: "'Lora', serif", fontSize: "14px", color: "var(--color-text-primary)", fontWeight: 400, margin: 0 };
const meta = { fontFamily: sans, fontSize: "11px", color: "var(--color-text-subtle)" };

export default function TankGlance({ entries, co2State, dropChecker, medOpen = [], onShowTrends }) {
  // "N days ago" depends on the viewer's local date. Public pages are server-rendered
  // (in UTC on Workers), so ages are only computed after mount to avoid a hydration mismatch.
  const [today, setToday] = useState(null);
  useEffect(() => { setToday(localDateStr()); }, []);

  const rows = useMemo(() => PARAM_META.map((m) => {
    const rs = readingsFor(entries, m.key);
    if (!rs.length) return null;
    const latest = rs[rs.length - 1];
    const prev = rs[rs.length - 2];
    return { meta: m, latest, prev, days: today ? diffDays(today, latest.entry.date) : null, trend: trend(latest, prev), status: rangeStatus(m.key, latest) };
  }).filter(Boolean), [entries, today]);

  const lastChange = useMemo(() => lastDoneFromEntries(entries).water_change, [entries]);
  const newestDays = today && rows.length ? Math.min(...rows.map((r) => r.days)) : null;
  const hasCo2 = !!(co2State && (co2State.status || co2State.bubbleRate || co2State.dropChecker || co2State.timerHours));

  if (!rows.length && !lastChange && !hasCo2 && !medOpen.length) return null;

  const water = [
    newestDays != null ? `tested ${fmtAgo(newestDays)}` : null,
    today && lastChange ? `changed ${fmtAgo(diffDays(today, lastChange))}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-label="Tank at a glance" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "12px", marginBottom: "22px", overflow: "hidden" }}>
      {(rows.length > 0 || lastChange) && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", marginBottom: rows.length ? "10px" : 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
              <h2 style={rowLabel}>Water</h2>
              {water && <span style={meta}>{water}</span>}
            </div>
            {onShowTrends && rows.length > 0 && (
              <button type="button" onClick={onShowTrends} style={{ background: "none", border: "none", padding: "2px 0", cursor: "pointer", fontFamily: sans, fontSize: "11px", color: "var(--color-accent)", whiteSpace: "nowrap" }}>
                Trends →
              </button>
            )}
          </div>

          {rows.length > 0 && (
            <dl style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "6px", fontFamily: sans }}>
              {rows.map(({ meta: m, latest, prev, days, trend: tr, status }) => {
                const unit = m.unit && !/[a-z°]/i.test(latest.raw) ? m.unit : "";
                const statusText = status ? `${status === "high" ? "Above" : "Below"} typical range (${formatTypical(m)}) — general guidance` : "";
                const trendText = tr ? `${tr.word} from ${prev.raw}` : "";
                const stale = days != null && newestDays != null && days > newestDays;
                return (
                  <div key={m.key}
                    title={[m.name, trendText, statusText, stale ? `tested ${fmtAgo(days)}` : ""].filter(Boolean).join(" · ")}
                    style={{
                      minWidth: "64px", padding: "5px 10px 6px", borderRadius: "8px",
                      border: `1px solid ${status ? "var(--color-warning-border)" : "var(--color-border-subtle)"}`,
                      background: status ? "var(--color-warning-bg)" : "var(--color-bg)",
                    }}>
                    <dt style={{ fontSize: "10px", color: "var(--color-text-muted)", letterSpacing: "0.02em" }}>
                      {m.label}{status && <span style={{ color: "var(--color-warning-text)", marginLeft: "4px" }}>{status}</span>}
                    </dt>
                    <dd style={{ margin: 0, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: "15px", fontWeight: 500, color: status ? "var(--color-warning-text)" : "var(--color-text-primary)" }}>{latest.raw}</span>
                      {unit && <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}> {unit}</span>}
                      {tr && <span aria-hidden="true" style={{ fontSize: "12px", color: "var(--color-text-muted)", marginLeft: "3px" }}>{tr.arrow}</span>}
                      <span className="tg-sr">{[trendText, statusText, stale ? `tested ${fmtAgo(days)}` : ""].filter(Boolean).join("; ")}</span>
                    </dd>
                    {stale && <dd aria-hidden="true" style={{ margin: 0, fontSize: "9px", color: "var(--color-text-faint)" }}>{fmtAgo(days)}</dd>}
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      )}

      {hasCo2 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px 14px", flexWrap: "wrap", padding: "9px 16px", borderTop: rows.length || lastChange ? "1px solid var(--color-border-subtle)" : "none", fontFamily: sans, fontSize: "12px", color: "var(--color-text-secondary)" }}>
          <h2 style={rowLabel}>CO₂</h2>
          {co2State.status && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: co2State.status === "on" ? "var(--color-success-bg)" : "var(--color-error-bg)",
              border: `1px solid ${co2State.status === "on" ? "var(--color-success-border)" : "var(--color-error-border)"}`,
              borderRadius: "4px", padding: "1px 7px", fontSize: "10px", fontWeight: 700,
              color: co2State.status === "on" ? "var(--color-success-text)" : "var(--color-error-text)",
            }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: co2State.status === "on" ? "#22c55e" : "#ef4444" }} />
              {co2State.status.toUpperCase()}
            </span>
          )}
          {co2State.bubbleRate && <span><span style={{ color: "var(--color-text-subtle)" }}>Bubbles</span> {co2State.bubbleRate} bps</span>}
          {dropChecker && (
            <span><span style={{ color: "var(--color-text-subtle)" }}>Drop checker</span>{" "}
              <span style={{ color: dropChecker.color, fontWeight: 500 }}>{dropChecker.label.split(" — ")[0]}</span>
            </span>
          )}
          {co2State.timerHours && (
            <span><span style={{ color: "var(--color-text-subtle)" }}>Timer</span> {co2State.timerHours}h/day{co2State.timerStart ? ` · ${co2State.timerStart}–${co2State.timerStop || "?"}` : ""}</span>
          )}
        </div>
      )}

      {medOpen.length > 0 && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px 10px", flexWrap: "wrap", padding: "9px 16px", background: "var(--color-medical-bg)", borderTop: "1px solid var(--color-error-border)", fontFamily: sans, fontSize: "12px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-error-text)", letterSpacing: "0.05em", textTransform: "uppercase" }}>✚ In treatment</span>
          {medOpen.map((e) => (
            <span key={e.id} style={{ color: "var(--color-medical-text)" }}>
              {e.data.fish}{e.data.count && e.data.count !== "1" ? ` × ${e.data.count}` : ""}
              <span style={{ color: "var(--color-text-subtle)", marginLeft: "4px" }}>— {e.data.symptoms || "treatment ongoing"}</span>
            </span>
          ))}
        </div>
      )}
      <style>{`.tg-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }`}</style>
    </section>
  );
}
