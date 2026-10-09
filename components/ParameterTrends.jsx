"use client";
/**
 * Trends view: small-multiple line charts of water parameters over a shared time axis.
 *
 * Loaded lazily from TankJournal (next/dynamic, ssr:false) so the journal view doesn't
 * pay for recharts. Everything here is derived from the entries list TankJournal has
 * already fetched — no extra requests, so it works the same on public read-only pages.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceArea, ReferenceLine,
} from "recharts";
import posthog from "posthog-js";
import {
  PARAM_META, readingsFor, entryTimestamp, formatTypical, rangeStatus, fmtNum,
} from "@/lib/params";

const DAY = 86400000;
const RANGES = [
  { key: "3M", label: "3M", months: 3, title: "Last 3 months" },
  { key: "6M", label: "6M", months: 6, title: "Last 6 months" },
  { key: "1Y", label: "1Y", months: 12, title: "Last year" },
  { key: "All", label: "All", months: null, title: "All time" },
];

const Y_AXIS_WIDTH = 38;
const CHART_MARGIN = { top: 10, right: 12, bottom: 0, left: 0 };
const CHART_HEIGHT = 156;

// Drop-checker colors are the indicator's literal colors (the data *is* a color), the
// same in both themes; they're always paired with a text label.
const DROP_CHECKER = {
  blue:       { label: "Blue",   meaning: "too little CO₂", color: "#3b82f6" },
  lime_green: { label: "Lime",   meaning: "about right",    color: "#84cc16" },
  yellow:     { label: "Yellow", meaning: "too much CO₂",   color: "#eab308" },
};

const sans = "'DM Sans', sans-serif";

// ─── Theme ────────────────────────────────────────────────────────────────────
// Chart tokens live in CSS (below) so light/dark follow the app's theme rules; SVG
// presentation attributes can't take var(), so read the resolved values and re-read
// when the theme changes.

const TOKENS = ["series", "wc", "fert", "band", "band-strong", "grid", "axis", "surface", "cursor"];

function readTokens(el) {
  const cs = getComputedStyle(el);
  const out = {};
  for (const t of TOKENS) out[t] = cs.getPropertyValue(`--pt-${t}`).trim();
  return out;
}

function useChartTokens(ref) {
  const [tokens, setTokens] = useState(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const update = () => ref.current && setTokens(readTokens(ref.current));
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", update);
    return () => { mo.disconnect(); mq.removeEventListener?.("change", update); };
  }, [ref]);
  return tokens;
}

/** Width of an element; pass the element itself (from a callback ref) so it re-binds. */
function useWidth(el) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [el]);
  return w;
}

// ─── Scales & formatting ──────────────────────────────────────────────────────

function niceStep(rough) {
  const pow = 10 ** Math.floor(Math.log10(rough));
  const f = rough / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function yScale(values, meta) {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (meta.zeroBased) lo = 0;
  if (hi - lo < meta.minSpan) {
    if (meta.zeroBased) hi = lo + meta.minSpan;
    else { const mid = (lo + hi) / 2; lo = mid - meta.minSpan / 2; hi = mid + meta.minSpan / 2; }
  }
  const pad = (hi - lo) * 0.1;
  hi += pad;
  if (!meta.zeroBased) lo -= pad;
  const step = niceStep((hi - lo) / 3);
  lo = Math.floor(lo / step + 1e-9) * step;
  hi = Math.ceil(hi / step - 1e-9) * step;
  if (meta.zeroBased) lo = Math.max(0, lo);
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, decimals };
}

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function xTicks(start, end, plotWidth) {
  const maxTicks = Math.max(2, Math.floor(plotWidth / 58));
  const spanDays = (end - start) / DAY;
  const steps = [
    { days: 7 }, { days: 14 }, { months: 1 }, { months: 2 }, { months: 3 }, { months: 6 }, { months: 12 },
  ];
  for (const s of steps) {
    const ticks = [];
    if (s.days) {
      if (spanDays / s.days > maxTicks) continue;
      // Align to Mondays so ticks don't drift between renders.
      const d = new Date(start); d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
      for (; d.getTime() <= end; d.setDate(d.getDate() + s.days)) ticks.push(d.getTime());
    } else {
      const d = new Date(start); d.setHours(0, 0, 0, 0); d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      while (d.getMonth() % s.months !== 0) d.setMonth(d.getMonth() + 1);
      for (; d.getTime() <= end; d.setMonth(d.getMonth() + s.months)) ticks.push(d.getTime());
    }
    if (ticks.length <= maxTicks && ticks.length >= 1) {
      const fmt = (t) => {
        const d = new Date(t);
        if (s.days) return `${MON[d.getMonth()]} ${d.getDate()}`;
        if (d.getMonth() === 0 || spanDays > 400) return `${MON[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
        return MON[d.getMonth()];
      };
      return { ticks, fmt };
    }
  }
  return { ticks: [start, end], fmt: (t) => fmtShortDate(t) };
}

function fmtShortDate(t) {
  const d = new Date(t);
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtDateTime(entry) {
  const d = new Date(`${entry.date}T12:00:00`);
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  return entry.time ? `${date} · ${entry.time}` : date;
}

function snippet(text, n = 90) {
  if (!text) return "";
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function withUnit(raw, unit) {
  if (!unit) return raw;
  return /[a-z°]/i.test(raw) ? raw : `${raw} ${unit}`;
}

function describeReading(r) {
  if (r.isRange) return `range ${fmtNum(r.range[0])}–${fmtNum(r.range[1])}, plotted at the midpoint`;
  if (r.qualifier === "<") return "below what the test reads, plotted at the limit";
  if (r.qualifier === ">") return "above what the test reads, plotted at the limit";
  if (r.qualifier === "~") return "approximate";
  return "";
}

function fertLabel(e) {
  const d = e.data || {};
  return [d.subject, d.quantity && `(${d.quantity})`].filter(Boolean).join(" ") || "Fertilized";
}

// ─── Data shaping ─────────────────────────────────────────────────────────────

function buildEvents(entries) {
  const waterChanges = [];
  const ferts = [];
  for (const e of entries) {
    const t = entryTimestamp(e);
    if (!Number.isFinite(t)) continue;
    if (e.type === "parameters" && e.data?.waterChange) waterChanges.push({ t, pct: e.data.waterChangePct, entry: e });
    if (e.type === "changes" && e.data?.changeType === "Fertilized") ferts.push({ t, entry: e });
  }
  return { waterChanges, ferts };
}

/** Rows for one chart: every reading of `key`, plus water-change / dosing events so the
 *  crosshair can land on them. Event-only rows have v = null (the line bridges them). */
function buildRows(readings, events, start, end) {
  const byT = new Map();
  const row = (t) => {
    if (!byT.has(t)) byT.set(t, { t, v: null, reading: null, wc: null, ferts: [] });
    return byT.get(t);
  };
  for (const r of readings) if (r.t >= start && r.t <= end) Object.assign(row(r.t), { v: r.value, reading: r });
  for (const w of events.waterChanges) if (w.t >= start && w.t <= end) row(w.t).wc = w;
  for (const f of events.ferts) if (f.t >= start && f.t <= end) row(f.t).ferts.push(f);
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

function dropCheckerSegments(entries, start, end) {
  const pts = entries
    .filter((e) => e.type === "co2" && DROP_CHECKER[e.data?.dropChecker])
    .map((e) => ({ t: entryTimestamp(e), color: e.data.dropChecker, entry: e }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  const segs = [];
  for (let i = 0; i < pts.length; i++) {
    const from = pts[i].t;
    const to = i + 1 < pts.length ? pts[i + 1].t : end;
    if (to <= start || from >= end) continue;
    segs.push({ ...pts[i], from: Math.max(from, start), to: Math.min(to, end), realFrom: from, realTo: i + 1 < pts.length ? to : null });
  }
  return segs;
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function ReadingDot({ cx, cy, payload, tokens, active }) {
  if (payload?.v == null || cx == null || cy == null) return <g />;
  const hollow = payload.reading && (payload.reading.qualifier || payload.reading.isRange);
  const r = active ? 5.5 : 4;
  return (
    <circle cx={cx} cy={cy} r={r}
      fill={hollow ? tokens.surface : tokens.series}
      stroke={hollow ? tokens.series : tokens.surface}
      strokeWidth={2} />
  );
}

function LineKey({ color, dashed }) {
  return <span aria-hidden="true" style={{ display: "inline-block", width: "12px", height: "2px", background: color, borderRadius: "1px", flexShrink: 0, opacity: dashed ? 0.7 : 1 }} />;
}

function TrendTooltip({ active, payload, label, meta, tokens }) {
  if (!active) return null;
  const row = payload?.[0]?.payload;
  if (!row) return null;
  const { reading, wc, ferts } = row;
  const entry = reading?.entry || wc?.entry || ferts[0]?.entry;
  const status = reading ? rangeStatus(meta.key, reading) : null;
  const notes = [reading?.entry, wc && wc.entry !== reading?.entry ? wc.entry : null, ...ferts.map((f) => f.entry)]
    .filter((e, i, a) => e && e.note && a.indexOf(e) === i);
  return (
    <div style={{
      background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "8px",
      padding: "8px 10px", fontFamily: sans, fontSize: "12px", color: "var(--color-text-secondary)",
      boxShadow: "0 4px 14px rgba(15,23,42,0.12)", maxWidth: "230px", lineHeight: 1.45,
    }}>
      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "3px" }}>
        {entry ? fmtDateTime(entry) : fmtShortDate(label)}
      </div>
      {reading ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <strong style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{withUnit(reading.raw, meta.unit)}</strong>
            <span style={{ color: "var(--color-text-muted)" }}>{meta.name}</span>
          </div>
          {describeReading(reading) && <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{describeReading(reading)}</div>}
          {status && (
            <div style={{ fontSize: "11px", color: "var(--color-warning-text)" }}>
              {status === "high" ? "▲ Above" : "▼ Below"} typical ({formatTypical(meta)})
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>No {meta.name} reading</div>
      )}
      {wc && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
          <LineKey color={tokens.wc} />
          <span>Water change{wc.pct ? ` · ${wc.pct}%` : ""}</span>
        </div>
      )}
      {ferts.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
          <LineKey color={tokens.fert} />
          <span>Fertilized · {fertLabel(f.entry)}</span>
        </div>
      ))}
      {notes.map((e) => (
        <div key={e.id} style={{ marginTop: "5px", fontSize: "11px", color: "var(--color-text-body)", fontStyle: "italic" }}>
          “{snippet(e.note)}”
        </div>
      ))}
    </div>
  );
}

function ParamChart({ meta, rows, readingsInRange, start, end, tokens, chartWidth }) {
  const plotWidth = Math.max(120, chartWidth - Y_AXIS_WIDTH - CHART_MARGIN.right);
  const values = readingsInRange.map((r) => r.value);
  const y = values.length ? yScale(values, meta) : null;
  const x = xTicks(start, end, plotWidth);
  const latest = readingsInRange[readingsInRange.length - 1];
  const t = meta.typical;
  const typical = formatTypical(meta);
  const unitSuffix = meta.unit ? ` (${meta.unit})` : "";
  const summary = latest
    ? `${meta.name}: ${readingsInRange.length} reading${readingsInRange.length === 1 ? "" : "s"} from ${fmtShortDate(readingsInRange[0].t)} to ${fmtShortDate(latest.t)}, latest ${withUnit(latest.raw, meta.unit)}. Typical range ${typical}.`
    : `${meta.name}: no readings in this range.`;

  return (
    <figure style={{ margin: 0, background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "12px", padding: "12px 12px 6px", minWidth: 0 }}>
      <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", padding: "0 2px 2px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Lora', serif", fontSize: "15px", color: "var(--color-text-primary)" }}>
            {meta.name}<span style={{ fontFamily: sans, fontSize: "11px", color: "var(--color-text-muted)" }}>{unitSuffix}</span>
          </div>
          <div style={{ fontFamily: sans, fontSize: "11px", color: "var(--color-text-muted)" }}>Typical: {typical}</div>
        </div>
        {latest && (
          <div style={{ textAlign: "right", fontFamily: sans, flexShrink: 0 }}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>{latest.raw}</div>
            <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>latest</div>
          </div>
        )}
      </figcaption>

      {y ? (
        <div role="img" aria-label={summary} style={{ height: CHART_HEIGHT, marginTop: "4px" }}>
            <ComposedChart width={chartWidth} height={CHART_HEIGHT} data={rows} margin={CHART_MARGIN} accessibilityLayer>
              <CartesianGrid vertical={false} stroke={tokens.grid} strokeWidth={1} />
              {t && t.max != null && t.min != null && t.max > t.min && (
                <ReferenceArea y1={t.min} y2={t.max} ifOverflow="hidden" fill={tokens.band} fillOpacity={1} stroke="none" />
              )}
              {t && t.max != null && t.min === t.max && (
                <ReferenceLine y={t.max} ifOverflow="hidden" stroke={tokens["band-strong"]} strokeWidth={5} />
              )}
              {rows.filter((r) => r.wc).map((r) => (
                <ReferenceLine key={`wc${r.t}`} x={r.t} stroke={tokens.wc} strokeOpacity={0.4} strokeWidth={1} />
              ))}
              {rows.filter((r) => r.ferts.length).map((r) => (
                <ReferenceLine key={`f${r.t}`} x={r.t} stroke={tokens.fert} strokeOpacity={0.7} strokeWidth={1} />
              ))}
              <XAxis
                dataKey="t" type="number" scale="time" domain={[start, end]} allowDataOverflow
                ticks={x.ticks} tickFormatter={x.fmt} interval={0}
                tick={{ fill: tokens.axis, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}
                tickLine={false} axisLine={{ stroke: tokens.grid }} height={22} tickMargin={6}
              />
              <YAxis
                type="number" domain={y.domain} ticks={y.ticks} allowDataOverflow width={Y_AXIS_WIDTH}
                tickFormatter={(v) => v.toFixed(y.decimals)}
                tick={{ fill: tokens.axis, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}
                tickLine={false} axisLine={false} tickMargin={4}
              />
              <Tooltip
                content={<TrendTooltip meta={meta} tokens={tokens} />}
                filterNull={false}
                cursor={{ stroke: tokens.cursor, strokeWidth: 1 }}
                isAnimationActive={false}
                wrapperStyle={{ zIndex: 5, outline: "none" }}
                allowEscapeViewBox={{ x: false, y: true }}
              />
              <Line
                dataKey="v" type="linear" connectNulls isAnimationActive={false}
                stroke={tokens.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                dot={(p) => <ReadingDot key={p.index} {...p} tokens={tokens} />}
                activeDot={(p) => <ReadingDot key={`a${p.index}`} {...p} tokens={tokens} active />}
              />
            </ComposedChart>
        </div>
      ) : (
        <div style={{ height: CHART_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontSize: "12px", color: "var(--color-text-subtle)" }}>
          No {meta.name} readings in this range
        </div>
      )}

      {readingsInRange.length > 0 && (
        <details className="pt-details">
          <summary>Data table</summary>
          <div style={{ maxHeight: "220px", overflowY: "auto" }}>
            <table>
              <caption className="pt-sr">{meta.name} readings{unitSuffix}</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">{meta.label}{unitSuffix}</th><th scope="col">Water change</th></tr></thead>
              <tbody>
                {[...readingsInRange].reverse().map((r) => (
                  <tr key={`${r.entry.id}-${r.t}`}>
                    <td>{fmtShortDate(r.t)}</td>
                    <td>{r.raw}{rangeStatus(meta.key, r) ? ` (${rangeStatus(meta.key, r)})` : ""}</td>
                    <td>{r.entry.data?.waterChange ? `${r.entry.data.waterChangePct || "?"}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}

function DropCheckerStrip({ segments, start, end, chartWidth }) {
  const [sel, setSel] = useState(null);
  const x = xTicks(start, end, Math.max(120, chartWidth - Y_AXIS_WIDTH - CHART_MARGIN.right));
  const span = end - start;
  const active = sel != null ? segments[sel] : null;
  return (
    <figure style={{ margin: 0, background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "12px", padding: "12px", minWidth: 0, alignSelf: "start" }}>
      <figcaption style={{ fontFamily: "'Lora', serif", fontSize: "15px", color: "var(--color-text-primary)", padding: "0 2px" }}>
        CO₂ drop checker
      </figcaption>
      <div style={{ position: "relative", height: "18px", margin: `10px ${CHART_MARGIN.right}px 0 ${Y_AXIS_WIDTH}px` }} role="list" aria-label="Drop checker color over time">
        {segments.map((s, i) => {
          const dc = DROP_CHECKER[s.color];
          const left = ((s.from - start) / span) * 100;
          const width = ((s.to - s.from) / span) * 100;
          const label = `${dc.label} (${dc.meaning}) from ${fmtShortDate(s.realFrom)}${s.realTo ? ` to ${fmtShortDate(s.realTo)}` : " onward"}`;
          return (
            <button key={i} type="button" role="listitem" aria-label={label} title={label}
              onClick={() => setSel(sel === i ? null : i)}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              className="pt-seg"
              style={{
                position: "absolute", top: 0, bottom: 0, left: `${left}%`, width: `calc(${width}% - 2px)`, minWidth: "3px",
                background: dc.color, border: "none", borderRadius: "4px", padding: 0, cursor: "pointer",
                outline: sel === i ? "2px solid var(--color-text-primary)" : "none", outlineOffset: "1px",
              }} />
          );
        })}
      </div>
      <div aria-hidden="true" style={{ position: "relative", height: "16px", margin: `4px ${CHART_MARGIN.right}px 0 ${Y_AXIS_WIDTH}px`, fontFamily: sans, fontSize: "11px", color: "var(--pt-axis)" }}>
        {x.ticks.map((t) => (
          <span key={t} style={{ position: "absolute", left: `${((t - start) / span) * 100}%`, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{x.fmt(t)}</span>
        ))}
      </div>
      <div style={{ fontFamily: sans, fontSize: "11px", color: "var(--color-text-muted)", margin: `8px 2px 0`, minHeight: "16px" }} aria-live="polite">
        {active ? (
          <span style={{ color: "var(--color-text-secondary)" }}>
            {DROP_CHECKER[active.color].label} — {DROP_CHECKER[active.color].meaning} · {fmtShortDate(active.realFrom)}{active.realTo ? ` → ${fmtShortDate(active.realTo)}` : " → now"}
            {active.entry.note ? ` · “${snippet(active.entry.note, 60)}”` : ""}
          </span>
        ) : (
          <span style={{ display: "inline-flex", gap: "12px", flexWrap: "wrap" }}>
            {Object.values(DROP_CHECKER).map((d) => (
              <span key={d.label} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span aria-hidden="true" style={{ width: "10px", height: "10px", borderRadius: "3px", background: d.color }} />
                {d.label} · {d.meaning}
              </span>
            ))}
          </span>
        )}
      </div>
    </figure>
  );
}

function Legend({ tokens, hasWc, hasFert }) {
  const item = { display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontFamily: sans, fontSize: "11px", color: "var(--color-text-muted)" }}>
      <span style={item}>
        <svg width="22" height="10" aria-hidden="true"><line x1="0" y1="5" x2="22" y2="5" stroke={tokens.series} strokeWidth="2" /><circle cx="11" cy="5" r="3.5" fill={tokens.series} stroke={tokens.surface} strokeWidth="1.5" /></svg>
        Reading
      </span>
      <span style={item}>
        <svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill={tokens.surface} stroke={tokens.series} strokeWidth="2" /></svg>
        Approx. or “&lt;5”
      </span>
      <span style={item}>
        <span aria-hidden="true" style={{ width: "14px", height: "10px", background: tokens.band, border: `1px solid ${tokens["band-strong"]}`, borderRadius: "2px" }} />
        Typical range
      </span>
      {hasWc && (
        <span style={item}>
          <span aria-hidden="true" style={{ width: "2px", height: "12px", background: tokens.wc }} />
          Water change
        </span>
      )}
      {hasFert && (
        <span style={item}>
          <span aria-hidden="true" style={{ width: "2px", height: "12px", background: tokens.fert }} />
          Fertilized
        </span>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ParameterTrends({ entries = [] }) {
  const rootRef = useRef(null);
  const [gridEl, setGridEl] = useState(null);
  const tokens = useChartTokens(rootRef);
  const gridWidth = useWidth(gridEl);
  const [range, setRange] = useState("6M");

  useEffect(() => {
    posthog.capture("trends_viewed", { range });
  }, [range]);

  const readingsByKey = useMemo(() => {
    const m = {};
    for (const meta of PARAM_META) m[meta.key] = readingsFor(entries, meta.key);
    return m;
  }, [entries]);

  const charted = PARAM_META.filter((m) => readingsByKey[m.key].length >= 2);
  const events = useMemo(() => buildEvents(entries), [entries]);

  const { start, end } = useMemo(() => {
    const now = new Date();
    const endT = Math.max(now.getTime(), ...Object.values(readingsByKey).flat().map((r) => r.t));
    const r = RANGES.find((x) => x.key === range);
    let startT;
    if (r.months) {
      const d = new Date(now); d.setMonth(d.getMonth() - r.months); d.setHours(0, 0, 0, 0);
      startT = d.getTime();
    } else {
      const all = Object.values(readingsByKey).flat().map((x) => x.t);
      startT = all.length ? Math.min(...all) : endT - 30 * DAY;
    }
    const pad = Math.max((endT - startT) * 0.025, DAY / 2);
    return { start: startT - pad, end: endT + pad };
  }, [range, readingsByKey]);

  const cols = gridWidth >= 640 ? 2 : 1;
  // Card width minus its 12px padding and 1px border on each side.
  const chartWidth = Math.floor((cols === 2 ? (gridWidth - 12) / 2 : gridWidth) - 26);

  const segments = useMemo(() => dropCheckerSegments(entries, start, end), [entries, start, end]);
  const anyInRange = charted.some((m) => readingsByKey[m.key].some((r) => r.t >= start && r.t <= end));
  const hasWc = events.waterChanges.some((w) => w.t >= start && w.t <= end);
  const hasFert = events.ferts.some((f) => f.t >= start && f.t <= end);

  return (
    <div ref={rootRef} className="pt-root" style={{ marginTop: "14px" }}>
      <style>{`
        .pt-root {
          --pt-series: #2a78d6;
          --pt-wc: #eb6834;
          --pt-fert: #1baf7a;
          --pt-band: rgba(15, 23, 42, 0.055);
          --pt-band-strong: rgba(15, 23, 42, 0.14);
          --pt-grid: #e5e7eb;
          --pt-axis: #64748b;
          --pt-surface: var(--color-surface);
          --pt-cursor: #94a3b8;
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .pt-root {
            --pt-series: #3987e5;
            --pt-wc: #d95926;
            --pt-fert: #199e70;
            --pt-band: rgba(241, 245, 249, 0.06);
            --pt-band-strong: rgba(241, 245, 249, 0.16);
            --pt-grid: #2d3f55;
            --pt-axis: #94a3b8;
            --pt-cursor: #64748b;
          }
        }
        [data-theme="dark"] .pt-root {
          --pt-series: #3987e5;
          --pt-wc: #d95926;
          --pt-fert: #199e70;
          --pt-band: rgba(241, 245, 249, 0.06);
          --pt-band-strong: rgba(241, 245, 249, 0.16);
          --pt-grid: #2d3f55;
          --pt-axis: #94a3b8;
          --pt-cursor: #64748b;
        }
        .pt-root .recharts-wrapper *:focus, .pt-root .recharts-wrapper:focus { outline: none; }
        .pt-root .recharts-surface:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; border-radius: 4px; }
        .pt-details { margin: 4px 2px 0; font-family: ${sans}; font-size: 11px; color: var(--color-text-muted); }
        .pt-details summary { cursor: pointer; padding: 4px 0; width: max-content; }
        .pt-details table { width: 100%; border-collapse: collapse; font-size: 12px; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; margin-bottom: 6px; }
        .pt-details th { text-align: left; font-weight: 500; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); padding: 4px 6px 4px 0; position: sticky; top: 0; background: var(--color-surface); }
        .pt-details td { padding: 3px 6px 3px 0; border-bottom: 1px solid var(--color-border-subtle); }
        .pt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .pt-seg:hover { opacity: 0.85; }
      `}</style>

      {charted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 16px", border: "1px dashed var(--color-border)", borderRadius: "12px", fontFamily: sans }}>
          <div style={{ fontFamily: "'Lora', serif", fontSize: "17px", color: "var(--color-text-primary)", marginBottom: "6px" }}>
            Log a few water tests to see trends
          </div>
          <div style={{ fontSize: "13px", color: "var(--color-text-muted)", maxWidth: "340px", margin: "0 auto", lineHeight: 1.5 }}>
            Charts appear here once a parameter has at least two readings. Add them as Water Parameters entries.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
            <div role="radiogroup" aria-label="Time range" style={{ display: "inline-flex", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "2px", gap: "2px" }}>
              {RANGES.map((r) => {
                const on = r.key === range;
                return (
                  <button key={r.key} type="button" role="radio" aria-checked={on} title={r.title}
                    onClick={() => setRange(r.key)}
                    style={{
                      minWidth: "44px", minHeight: "32px", padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                      fontFamily: sans, fontSize: "12px", fontWeight: on ? 600 : 400,
                      background: on ? "var(--color-filter-active-bg)" : "transparent",
                      color: on ? "var(--color-filter-active-text)" : "var(--color-text-muted)",
                    }}>{r.label}</button>
                );
              })}
            </div>
            {tokens && <Legend tokens={tokens} hasWc={hasWc} hasFert={hasFert} />}
          </div>

          <div ref={setGridEl} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "12px", opacity: tokens && gridWidth ? 1 : 0 }}>
            {tokens && gridWidth > 0 && charted.map((meta) => {
              const all = readingsByKey[meta.key];
              const inRange = all.filter((r) => r.t >= start && r.t <= end);
              const rows = buildRows(all, events, start, end);
              return (
                <ParamChart key={meta.key} meta={meta} rows={rows} readingsInRange={inRange}
                  start={start} end={end} tokens={tokens} chartWidth={chartWidth} />
              );
            })}
            {tokens && gridWidth > 0 && segments.length > 0 && (
              <DropCheckerStrip segments={segments} start={start} end={end} chartWidth={chartWidth} />
            )}
          </div>

          {!anyInRange && (
            <div style={{ fontFamily: sans, fontSize: "12px", color: "var(--color-text-muted)", marginTop: "10px" }}>
              No water tests in this range.{" "}
              <button type="button" onClick={() => setRange("All")} style={{ background: "none", border: "none", padding: 0, color: "var(--color-accent)", cursor: "pointer", fontFamily: sans, fontSize: "12px" }}>Show all time</button>
            </div>
          )}

          <p style={{ fontFamily: sans, fontSize: "11px", color: "var(--color-text-subtle)", lineHeight: 1.5, margin: "14px 2px 0" }}>
            Shaded bands are general freshwater guidance, not targets — what’s right depends on your fish, shrimp and plants.
            Hollow points are approximate or beyond what the test reads (e.g. “&lt;5”); ranges like “7.0–7.2” plot at the midpoint.
          </p>
        </>
      )}
    </div>
  );
}
