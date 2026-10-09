"use client";
/**
 * Sidebar card: the most recent reading of each water parameter, how old it is, and
 * which way it moved since the previous reading. Values outside the typical range
 * (general guidance from lib/params.js) get a quiet "high"/"low" flag.
 */
import { useMemo } from "react";
import { PARAM_META, readingsFor, rangeStatus, formatTypical } from "@/lib/params";
import { localDateStr } from "@/lib/dates";

const sans = "'DM Sans', sans-serif";

function daysBetween(fromDateStr, toDateStr) {
  const a = new Date(`${fromDateStr}T12:00:00`);
  const b = new Date(`${toDateStr}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

function ageText(days) {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} wks ago`;
  if (days < 365) return `${Math.round(days / 30)} mo ago`;
  const y = Math.round(days / 365);
  return `${y} yr${y === 1 ? "" : "s"} ago`;
}

function trend(latest, prev) {
  if (!prev) return null;
  const d = latest.value - prev.value;
  const eps = Math.max(Math.abs(prev.value), 1) * 1e-6;
  if (d > eps) return { arrow: "↑", word: "up" };
  if (d < -eps) return { arrow: "↓", word: "down" };
  return { arrow: "→", word: "unchanged" };
}

export default function LatestParamsCard({ entries, loading, onShowTrends }) {
  const rows = useMemo(() => {
    const today = localDateStr();
    return PARAM_META.map((meta) => {
      const rs = readingsFor(entries, meta.key);
      if (!rs.length) return null;
      const latest = rs[rs.length - 1];
      const prev = rs[rs.length - 2];
      return {
        meta, latest, prev,
        days: daysBetween(latest.entry.date, today),
        trend: trend(latest, prev),
        status: rangeStatus(meta.key, latest),
      };
    }).filter(Boolean);
  }, [entries]);

  const newestDays = rows.length ? Math.min(...rows.map((r) => r.days)) : null;

  return (
    <section aria-labelledby="latest-params-title" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "12px", padding: "14px 18px", marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: rows.length ? "8px" : 0 }}>
        <div>
          <h2 id="latest-params-title" style={{ fontFamily: "'Lora', serif", fontSize: "15px", color: "var(--color-text-primary)", fontWeight: 400, margin: 0 }}>Water</h2>
          {newestDays != null && (
            <div style={{ fontFamily: sans, fontSize: "11px", color: "var(--color-text-subtle)", marginTop: "1px" }}>Last test {ageText(newestDays)}</div>
          )}
        </div>
        {onShowTrends && rows.length > 0 && (
          <button type="button" onClick={onShowTrends} style={{ background: "none", border: "none", padding: "4px 0", cursor: "pointer", fontFamily: sans, fontSize: "11px", color: "var(--color-accent)" }}>
            Trends →
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: "12px", color: "var(--color-text-faint)", fontFamily: sans, marginTop: "6px" }}>
          {loading ? "Loading…" : "No water tests yet"}
        </div>
      ) : (
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr auto", columnGap: "8px", rowGap: "5px", alignItems: "baseline", fontFamily: sans, fontSize: "12px" }}>
          {rows.map(({ meta, latest, prev, days, trend: tr, status }) => {
            const unit = meta.unit && !/[a-z°]/i.test(latest.raw) ? meta.unit : "";
            const statusText = status ? `${status === "high" ? "Above" : "Below"} typical range (${formatTypical(meta)}) — general guidance` : "";
            const trendText = tr ? `${tr.word} from ${prev.raw}` : "";
            return (
              <div key={meta.key} style={{ display: "contents" }}>
                <dt style={{ color: "var(--color-text-muted)" }} title={meta.name}>{meta.label}</dt>
                <dd style={{ margin: 0, color: "var(--color-text-secondary)", whiteSpace: "nowrap", minWidth: 0 }} title={[statusText, trendText].filter(Boolean).join(" · ") || undefined}>
                  <span style={{ fontWeight: 500, color: status ? "var(--color-warning-text)" : "var(--color-text-secondary)" }}>{latest.raw}</span>
                  {unit && <span style={{ color: "var(--color-text-muted)", fontSize: "10px" }}> {unit}</span>}
                  {tr && (
                    <span aria-hidden="true" style={{ color: "var(--color-text-muted)", marginLeft: "4px" }}>{tr.arrow}</span>
                  )}
                  {status && (
                    <span style={{ marginLeft: "5px", fontSize: "10px", color: "var(--color-warning-text)", border: "1px solid var(--color-warning-border)", background: "var(--color-warning-bg)", borderRadius: "3px", padding: "0 4px" }}>
                      {status}
                    </span>
                  )}
                  <span className="lp-sr">{[trendText, statusText].filter(Boolean).join("; ")}</span>
                </dd>
                <dd style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "11px", textAlign: "right", whiteSpace: "nowrap" }}>{ageText(days)}</dd>
              </div>
            );
          })}
        </dl>
      )}
      <style>{`.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }`}</style>
    </section>
  );
}
