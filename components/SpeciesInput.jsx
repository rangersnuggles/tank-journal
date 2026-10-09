"use client";
/**
 * SpeciesInput — free-text name field with grouped type-ahead suggestions.
 *
 * Implements the WAI-ARIA 1.2 combobox pattern (input + listbox, list
 * autocomplete, aria-activedescendant). Suggestions come from three places:
 *   - "In this tank": the current tank's inhabitants (local, instant)
 *   - "Your past names": GET /api/me/names?q= (the user's own history)
 *   - "Species": GET /api/species?q= (Wikidata-derived catalog, CC0)
 * Free text is always allowed: nothing is selected until the user picks an
 * option (click/tap, or ↑/↓ then Enter), so cultivar names like "Monte Carlo"
 * or brand names like "Easy Green" save exactly as typed.
 *
 * onChange(text, speciesId | null) — speciesId is set only when the picked
 * option is linked to a catalog species; typing clears it.
 */
import { useState, useEffect, useLayoutEffect, useRef, useId, useMemo } from "react";
import posthog from "posthog-js";

const DEBOUNCE_MS = 150;
const MAX_TANK = 6;
const MAX_HISTORY = 5;
const MAX_SPECIES = 8;

// Response cache shared by every instance on the page (keyed by URL).
const responseCache = new Map();
async function cachedJson(url, signal) {
  if (responseCache.has(url)) return responseCache.get(url);
  const res = await fetch(url, { signal, credentials: "same-origin" });
  if (!res.ok) return [];
  const json = await res.json();
  if (responseCache.size > 200) responseCache.clear();
  responseCache.set(url, json);
  return json;
}

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
// "amano shrimps" and "amano shrimp" are the same suggestion.
const dedupeKey = (s) => norm(s).replace(/s$/, "");
const KIND_LABEL = { fish: "fish", invert: "invert", plant: "plant" };

export default function SpeciesInput({
  value = "",
  speciesId = null,
  onChange,
  inhabitants = [],
  kind = null,
  placeholder,
  ariaLabel,
  style,
  autoFocus = false,
}) {
  const uid = useId().replace(/:/g, "");
  const listId = `species-list-${uid}`;
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState({ q: null, history: [], species: [] });
  const [loading, setLoading] = useState(false);
  const [popupBox, setPopupBox] = useState({ left: 0, width: null });

  const q = norm(value);

  // ── Remote suggestions (debounced) ──
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const kindParam = kind ? `&kind=${encodeURIComponent(kind)}` : "";
        const [history, species] = await Promise.all([
          cachedJson(`/api/me/names?q=${encodeURIComponent(q)}`, ctrl.signal).catch(() => []),
          q ? cachedJson(`/api/species?q=${encodeURIComponent(q)}${kindParam}`, ctrl.signal).catch(() => []) : [],
        ]);
        if (!ctrl.signal.aborted) setRemote({ q, history: Array.isArray(history) ? history : [], species: Array.isArray(species) ? species : [] });
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open, kind]);

  // ── Build grouped options ──
  const groups = useMemo(() => {
    const tank = inhabitants
      .filter((i) => i?.name && (!q || norm(i.name).includes(q)))
      .slice(0, MAX_TANK)
      .map((i) => ({
        source: "tank",
        key: `t${i.id}`,
        label: i.name,
        sci: i.species_scientific_name && norm(i.species_scientific_name) !== norm(i.name) ? i.species_scientific_name : null,
        speciesId: i.species_id ?? null,
        meta: i.count != null ? `×${i.count}` : null,
      }));
    const shownNames = new Set(tank.map((o) => dedupeKey(o.label)));
    const linkedIds = new Set(tank.map((o) => o.speciesId).filter(Boolean));

    // While a request for the new text is in flight, keep showing the previous
    // results that still match it (no flicker, no stale mismatches).
    const fresh = remote.q === q;
    const stillMatches = (...texts) => fresh || texts.some((t) => t && norm(t).includes(q));
    const history = [];
    for (const h of remote.history) {
      if (history.length >= MAX_HISTORY) break;
      if (!h?.name || !stillMatches(h.name) || shownNames.has(dedupeKey(h.name))) continue;
      shownNames.add(dedupeKey(h.name));
      if (h.species_id) linkedIds.add(h.species_id);
      history.push({ source: "history", key: `h${norm(h.name)}`, label: h.name, sci: null, speciesId: h.species_id ?? null, meta: null });
    }
    const species = (q ? remote.species : [])
      .filter((s) => stillMatches(s.common_name, s.scientific_name, s.matched_alias))
      .filter((s) => !linkedIds.has(s.id))
      .slice(0, MAX_SPECIES)
      .map((s) => ({
        source: "catalog",
        key: `s${s.id}`,
        label: s.common_name,
        sci: norm(s.scientific_name) !== norm(s.common_name) ? s.scientific_name : null,
        // Explain alias-only hits ("hornwort" → Rigid hornwort); redundant when the name itself matches.
        alias: s.matched_alias && !norm(s.common_name).includes(q) && !norm(s.scientific_name).includes(q) ? s.matched_alias : null,
        speciesId: s.id,
        kind: s.kind,
        meta: KIND_LABEL[s.kind] ?? null,
      }));

    return [
      { id: "tank", label: "In this tank", options: tank },
      { id: "history", label: "Your past names", options: history },
      { id: "catalog", label: "Species", options: species },
    ].filter((g) => g.options.length);
  }, [inhabitants, q, remote]);

  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const optionId = (i) => `${listId}-opt-${i}`;
  const showPopup = open && flat.length > 0;

  // Typing changes the option list; drop the highlight so Enter keeps free text.
  useEffect(() => { setActive(-1); }, [q]);
  useEffect(() => { if (active >= flat.length) setActive(flat.length - 1); }, [flat.length, active]);

  // Keep the highlighted option visible.
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`#${CSS.escape(optionId(active))}`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Size/position the popup so it stays on-screen in narrow grid columns (mobile).
  useLayoutEffect(() => {
    if (!showPopup) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = document.documentElement.clientWidth;
      const width = Math.min(Math.max(r.width, 280), vw - 16);
      let left = 0;
      if (r.left + width > vw - 8) left = vw - 8 - width - r.left;
      if (r.left + left < 8) left = 8 - r.left;
      setPopupBox({ left, width });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [showPopup]);

  function select(opt) {
    onChange?.(opt.label, opt.speciesId ?? null);
    setOpen(false);
    setActive(-1);
    posthog.capture("species_suggestion_selected", { source: opt.source, kind: opt.kind ?? null, linked: !!opt.speciesId });
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (flat.length) setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (flat.length) setActive((a) => (a <= 0 ? flat.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (showPopup && active >= 0 && flat[active]) {
        e.preventDefault();
        select(flat[active]);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const linkedSci = useMemo(() => {
    if (!speciesId) return null;
    const fromTank = inhabitants.find((i) => i.species_id === speciesId)?.species_scientific_name;
    if (fromTank) return fromTank;
    return remote.species.find((s) => s.id === speciesId)?.scientific_name ?? null;
  }, [speciesId, inhabitants, remote.species]);

  let idx = -1;
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPopup}
        aria-controls={listId}
        aria-activedescendant={showPopup && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        enterKeyHint="done"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange?.(e.target.value, null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={style}
      />
      {speciesId && linkedSci && norm(linkedSci) !== q && (
        <div title="Linked to a catalog species" style={{ fontSize: "10px", fontStyle: "italic", color: "var(--color-text-muted)", fontFamily: "'DM Sans', sans-serif", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {linkedSci}
        </div>
      )}

      <div
        style={{
          display: showPopup ? "block" : "none",
          position: "absolute", top: "calc(100% + 4px)", left: popupBox.left, width: popupBox.width ?? "100%",
          zIndex: 50, background: "var(--color-bg)", border: "1px solid var(--color-border)",
          borderRadius: "8px", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)", overflow: "hidden",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div ref={listRef} id={listId} role="listbox" aria-label={ariaLabel ? `${ariaLabel} suggestions` : "Suggestions"}
          style={{ maxHeight: "min(320px, 50vh)", overflowY: "auto", overscrollBehavior: "contain", padding: "4px 0" }}>
          {groups.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`${listId}-${g.id}`}>
              <div id={`${listId}-${g.id}`} role="presentation" style={{
                padding: "6px 12px 3px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em",
                textTransform: "uppercase", color: "var(--color-text-muted)",
              }}>{g.label}</div>
              {g.options.map((opt) => {
                idx += 1;
                const i = idx;
                const isActive = i === active;
                return (
                  <div
                    key={opt.key}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(e) => e.preventDefault() /* keep focus in the input */}
                    onMouseMove={() => { if (active !== i) setActive(i); }}
                    onClick={() => select(opt)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px", minHeight: "36px",
                      padding: "6px 12px", cursor: "pointer",
                      background: isActive ? "var(--color-info-bg)" : "transparent",
                      boxShadow: isActive ? "inset 2px 0 0 var(--color-accent)" : "none",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                      <div style={{ fontSize: "13px", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opt.label}
                      </div>
                      {(opt.sci || opt.alias) && (
                        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {opt.sci && <i>{opt.sci}</i>}
                          {opt.alias && norm(opt.alias) !== norm(opt.label) && <span>{opt.sci ? " · " : ""}“{opt.alias}”</span>}
                        </div>
                      )}
                    </div>
                    {opt.meta && (
                      <span style={{ flexShrink: 0, fontSize: "10px", color: "var(--color-text-subtle)", letterSpacing: "0.03em" }}>{opt.meta}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {groups.some((g) => g.id === "catalog") && (
          <div style={{ borderTop: "1px solid var(--color-border-subtle)", padding: "4px 12px", fontSize: "10px", color: "var(--color-text-subtle)" }}>
            Species data from Wikidata (CC0)
          </div>
        )}
      </div>

      <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {open && !loading && q ? (flat.length ? `${flat.length} suggestion${flat.length === 1 ? "" : "s"} available` : "") : ""}
      </div>
    </div>
  );
}
