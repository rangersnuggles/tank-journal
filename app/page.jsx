"use client";
import { useState, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTRY_TYPES = {
  parameters:   { label: "Water Parameters", color: "#0891b2", icon: "◎" },
  changes:      { label: "Plant / Livestock", color: "#059669", icon: "⬡" },
  observations: { label: "Observation",       color: "#7c3aed", icon: "◈" },
  medical:      { label: "Medical",           color: "#dc2626", icon: "✚" },
};

const PARAMS = [
  { key: "temp",    label: "Temp",  unit: "°F"  },
  { key: "ph",      label: "pH",    unit: ""    },
  { key: "ammonia", label: "NH₃",   unit: "ppm" },
  { key: "nitrite", label: "NO₂",   unit: "ppm" },
  { key: "nitrate", label: "NO₃",   unit: "ppm" },
  { key: "gh",      label: "GH",    unit: "°dH" },
  { key: "kh",      label: "KH",    unit: "°dH" },
];

const CHANGE_TYPES        = ["Added","Removed","Trimmed","Died","Moved","Fertilized"];
const REMOVE_CHANGE_TYPES = ["Removed","Died","Moved"];
const OUTCOMES            = ["","Recovered — returned to display","Still in treatment","Died","Other"];

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle = {
  padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
  fontSize: "13px", background: "#fafafa", color: "#1e293b",
  outline: "none", width: "100%", boxSizing: "border-box",
  fontFamily: "'DM Sans', sans-serif",
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return "";
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function ParamBadge({ label, value, unit }) {
  if (!value) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "baseline", gap: "2px",
      background: "#f0f9ff", border: "1px solid #bae6fd",
      borderRadius: "4px", padding: "2px 7px", fontSize: "11px",
      fontFamily: "'Courier New', monospace", color: "#0c4a6e",
    }}>
      <span style={{ color: "#64748b", fontSize: "10px", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontWeight: 600, marginLeft: "3px" }}>{value}{unit}</span>
    </span>
  );
}

function OutcomePill({ outcome }) {
  if (!outcome) return null;
  const isRecovered = outcome.startsWith("Recovered");
  const isDied      = outcome === "Died";
  const bg    = isRecovered ? "#f0fdf4" : isDied ? "#fef2f2" : "#fff7ed";
  const color = isRecovered ? "#15803d"  : isDied ? "#b91c1c" : "#c2410c";
  return (
    <span style={{
      display: "inline-block", background: bg, color,
      border: `1px solid ${color}22`, borderRadius: "4px",
      padding: "2px 8px", fontSize: "11px", fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif",
    }}>{outcome}</span>
  );
}

function MedicalDetail({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: "6px", fontSize: "12px", fontFamily: "'DM Sans', sans-serif" }}>
      <span style={{ color: "#94a3b8", flexShrink: 0, minWidth: "90px" }}>{label}</span>
      <span style={{ color: "#334155" }}>{value}</span>
    </div>
  );
}

function EntryCard({ entry, onDelete }) {
  const type      = ENTRY_TYPES[entry.type];
  const isMedical = entry.type === "medical";
  const d         = entry.data || {};

  return (
    <div style={{
      display: "flex", gap: "14px", padding: "18px 0",
      borderBottom: "1px solid #f1f5f9", animation: "fadeIn 0.3s ease",
      ...(isMedical ? {
        background: "#fff5f5", margin: "0 -12px",
        padding: "18px 12px", borderRadius: "6px",
        borderBottom: "none", marginBottom: "1px",
      } : {}),
    }}>
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "2px" }}>
        <span style={{
          fontSize: isMedical ? "13px" : "15px", color: type.color,
          ...(isMedical ? {
            background: "#fecaca", borderRadius: "4px",
            width: "22px", height: "22px",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
          } : {}),
        }}>{type.icon}</span>
        {!isMedical && <div style={{ width: "1px", flex: 1, background: "#f1f5f9", marginTop: "8px", minHeight: "16px" }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7px" }}>
          <div>
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: type.color }}>{type.label}</span>
            <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "8px", fontFamily: "'DM Sans', sans-serif" }}>
              {fmtDate(entry.date)} · {entry.time}
            </span>
          </div>
          <button onClick={() => onDelete(entry.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: "14px", padding: "0 0 0 8px", lineHeight: 1 }}>×</button>
        </div>

        {entry.type === "parameters" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: entry.note ? "7px" : 0 }}>
            {PARAMS.map(p => d[p.key] ? <ParamBadge key={p.key} label={p.label} value={d[p.key]} unit={p.unit} /> : null)}
            {d.waterChange && (
              <span style={{
                display: "inline-flex", alignItems: "baseline", gap: "2px",
                background: "#f0f9ff", border: "1px solid #bae6fd",
                borderRadius: "4px", padding: "2px 7px", fontSize: "11px",
                fontFamily: "'Courier New', monospace", color: "#0c4a6e",
              }}>
                <span style={{ fontSize: "10px", color: "#64748b", letterSpacing: "0.05em" }}>Water Change</span>
                <span style={{ fontWeight: 600, marginLeft: "3px" }}>{d.waterChangePct}%</span>
              </span>
            )}
          </div>
        )}

        {entry.type === "changes" && d.changeType && (
          <div style={{ fontSize: "13px", color: "#334155", marginBottom: entry.note ? "7px" : 0, fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ background: "#f0fdf4", color: "#15803d", padding: "1px 7px", borderRadius: "3px", fontSize: "11px", fontWeight: 600, marginRight: "8px" }}>{d.changeType}</span>
            {d.subject}
            {d.quantity && <span style={{ color: "#94a3b8" }}> × {d.quantity}</span>}
          </div>
        )}

        {entry.type === "medical" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: entry.note ? "10px" : 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "#1e293b", fontFamily: "'DM Sans', sans-serif", marginBottom: "4px" }}>
              {d.fish}
              {d.count && d.count !== "1" && <span style={{ color: "#94a3b8", fontWeight: 400 }}> × {d.count}</span>}
            </div>
            <MedicalDetail label="Symptoms"  value={d.symptoms}  />
            <MedicalDetail label="Treatment" value={d.treatment} />
            {(d.dateIn || d.dateOut) && (
              <MedicalDetail label="Hospital" value={[
                d.dateIn  && `In: ${fmtDate(d.dateIn)}`,
                d.dateOut && `Out: ${fmtDate(d.dateOut)}`,
              ].filter(Boolean).join("  ·  ")} />
            )}
            {d.outcome && <div style={{ marginTop: "4px" }}><OutcomePill outcome={d.outcome} /></div>}
          </div>
        )}

        {entry.note && <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.6", fontFamily: "'DM Sans', sans-serif" }}>{entry.note}</p>}
      </div>
    </div>
  );
}

// ─── Inhabitant sidebar ───────────────────────────────────────────────────────

function InhabitantRow({ inh, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const since = new Date(inh.date_added + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <div style={{ borderBottom: "1px solid #f1f5f9", padding: "9px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#1e293b", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inh.name}</div>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginTop: "1px" }}>
            {inh.count != null ? `${inh.count} · ` : ""}{since}
          </div>
        </div>
        <span style={{ fontSize: "9px", color: "#cbd5e1", flexShrink: 0, paddingLeft: "8px" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: "8px", animation: "fadeIn 0.2s ease" }}>
          {inh.notes && <p style={{ margin: "0 0 7px", fontSize: "12px", color: "#64748b", fontFamily: "'DM Sans', sans-serif", lineHeight: "1.5" }}>{inh.notes}</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => onEdit(inh)} style={{ fontSize: "11px", color: "#0891b2", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'DM Sans', sans-serif" }}>Edit</button>
            <button onClick={() => onDelete(inh.id)} style={{ fontSize: "11px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InhabitantForm({ initial, onSave, onCancel, saving }) {
  const [name, setName]           = useState(initial?.name || "");
  const [count, setCount]         = useState(initial?.count ?? "");
  const [dateAdded, setDateAdded] = useState(initial?.date_added || new Date().toISOString().split("T")[0]);
  const [notes, setNotes]         = useState(initial?.notes || "");

  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", marginBottom: "12px", animation: "fadeIn 0.2s ease" }}>
      {initial && <div style={{ fontSize: "10px", fontWeight: 600, color: "#64748b", marginBottom: "8px", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Editing</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        <input placeholder="Name / species" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
          <input placeholder="Count" type="number" value={count} onChange={e => setCount(e.target.value)} style={inputStyle} />
          <input type="date" value={dateAdded} onChange={e => setDateAdded(e.target.value)} style={inputStyle} />
        </div>
        <textarea placeholder="Notes / care info…" rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }} />
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={saving} style={{ fontSize: "11px", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button
            disabled={saving || !name.trim()}
            onClick={() => onSave({ name: name.trim(), count: count !== "" ? parseInt(count) : null, date_added: dateAdded, notes })}
            style={{ fontSize: "11px", background: "#0891b2", color: "#fff", border: "none", borderRadius: "5px", padding: "5px 12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : initial ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Entry forms ──────────────────────────────────────────────────────────────

function ParametersForm({ data, setData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: "8px" }}>
        {PARAMS.map(p => (
          <label key={p.key} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "10px", color: "#64748b", letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif" }}>{p.label}{p.unit ? ` (${p.unit})` : ""}</span>
            <input type="text" inputMode="decimal" placeholder="—" value={data[p.key] || ""} onChange={e => setData({ ...data, [p.key]: e.target.value })} style={inputStyle} />
          </label>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "4px", borderTop: "1px solid #f1f5f9" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "#475569" }}>
          <input
            type="checkbox"
            checked={!!data.waterChange}
            onChange={e => setData({ ...data, waterChange: e.target.checked, waterChangePct: e.target.checked ? (data.waterChangePct || "20") : "" })}
            style={{ width: "14px", height: "14px", accentColor: "#0891b2", cursor: "pointer" }}
          />
          Water change
        </label>
        {data.waterChange && (
          <select
            value={data.waterChangePct || "20"}
            onChange={e => setData({ ...data, waterChangePct: e.target.value })}
            style={{ ...inputStyle, width: "90px" }}
          >
            {[10,20,30,40,50,60,70,80,90,100].map(p => (
              <option key={p} value={p}>{p}%</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function ChangesForm({ data, setData }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 65px", gap: "8px" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Type</span>
        <select value={data.changeType || ""} onChange={e => setData({ ...data, changeType: e.target.value })} style={inputStyle}>
          <option value="">Select…</option>
          {CHANGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Plant / Animal / Item</span>
        <input type="text" placeholder="e.g. Amano shrimp…" value={data.subject || ""} onChange={e => setData({ ...data, subject: e.target.value })} style={inputStyle} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Qty</span>
        <input type="text" placeholder="—" value={data.quantity || ""} onChange={e => setData({ ...data, quantity: e.target.value })} style={inputStyle} />
      </label>
    </div>
  );
}

function MedicalForm({ data, setData, inhabitants }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 80px", gap: "8px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Fish / inhabitant *</span>
          <input list="inhabitant-list" type="text" placeholder="Select or type name…" value={data.fish || ""} onChange={e => setData({ ...data, fish: e.target.value })} style={inputStyle} />
          <datalist id="inhabitant-list">
            {inhabitants.map(i => <option key={i.id} value={i.name} />)}
          </datalist>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Count</span>
          <input type="number" min="1" placeholder="1" value={data.count || ""} onChange={e => setData({ ...data, count: e.target.value })} style={inputStyle} />
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Symptoms / diagnosis</span>
        <input type="text" placeholder="e.g. Clamped fins, white spots, lethargy…" value={data.symptoms || ""} onChange={e => setData({ ...data, symptoms: e.target.value })} style={inputStyle} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Treatment (medication, dose)</span>
        <input type="text" placeholder="e.g. Kanaplex — 1 scoop per 5 gal" value={data.treatment || ""} onChange={e => setData({ ...data, treatment: e.target.value })} style={inputStyle} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Hospital tank in</span>
          <input type="date" value={data.dateIn || ""} onChange={e => setData({ ...data, dateIn: e.target.value })} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Hospital tank out</span>
          <input type="date" value={data.dateOut || ""} onChange={e => setData({ ...data, dateOut: e.target.value })} style={inputStyle} />
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Outcome</span>
        <select value={data.outcome || ""} onChange={e => setData({ ...data, outcome: e.target.value })} style={inputStyle}>
          {OUTCOMES.map(o => <option key={o} value={o}>{o || "— select if known —"}</option>)}
        </select>
      </label>
      {data.outcome === "Died" && data.fish && (
        <p style={{ margin: 0, fontSize: "11px", color: "#dc2626", fontFamily: "'DM Sans', sans-serif" }}>✚ Will decrement "{data.fish}" count in inhabitants.</p>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const todayStr  = new Date().toISOString().split("T")[0];
const nowTime   = new Date().toTimeString().slice(0, 5);

export default function TankJournal() {
  const [entries, setEntries]         = useState([]);
  const [inhabitants, setInhabitants] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  const [showForm, setShowForm]       = useState(false);
  const [activeType, setActiveType]   = useState("parameters");
  const [formData, setFormData]       = useState({});
  const [note, setNote]               = useState("");
  const [date, setDate]               = useState(todayStr);
  const [time, setTime]               = useState(nowTime);
  const [filterType, setFilterType]   = useState("all");

  const [showAddInh, setShowAddInh]   = useState(false);
  const [editingInh, setEditingInh]   = useState(null);
  const [savingInh, setSavingInh]     = useState(false);

  // ── Fetch on mount ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, i] = await Promise.all([
        apiFetch("/api/entries"),
        apiFetch("/api/inhabitants"),
      ]);
      setEntries(e);
      setInhabitants(i);
    } catch (err) {
      setError("Failed to load data. Check your Supabase credentials.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Inhabitant sync helpers ──
  const patchInhabitantCount = async (name, delta) => {
    const norm = name.trim().toLowerCase();
    const inh  = inhabitants.find(i => i.name.trim().toLowerCase() === norm);
    if (!inh) return;
    const newCount = (inh.count ?? 0) + delta;
    if (newCount <= 0) {
      await apiFetch(`/api/inhabitants/${inh.id}`, { method: "DELETE" });
    } else {
      await apiFetch(`/api/inhabitants/${inh.id}`, { method: "PATCH", body: JSON.stringify({ count: newCount }) });
    }
  };

  const addOrUpdateInhabitant = async (name, qty, dateAdded) => {
    const norm = name.trim().toLowerCase();
    const inh  = inhabitants.find(i => i.name.trim().toLowerCase() === norm);
    if (inh) {
      await apiFetch(`/api/inhabitants/${inh.id}`, { method: "PATCH", body: JSON.stringify({ count: (inh.count ?? 0) + qty }) });
    } else {
      await apiFetch("/api/inhabitants", { method: "POST", body: JSON.stringify({ name: name.trim(), count: qty || null, date_added: dateAdded, notes: "" }) });
    }
  };

  // ── Submit entry ──
  const handleSubmit = async () => {
    if (activeType === "parameters" && Object.values(formData).every(v => !v) && !note) return;
    if (activeType === "changes" && !formData.changeType) return;
    if (activeType === "observations" && !note.trim()) return;
    if (activeType === "medical" && !formData.fish) return;

    setSaving(true);
    try {
      await apiFetch("/api/entries", {
        method: "POST",
        body: JSON.stringify({ type: activeType, date, time, data: formData, note }),
      });

      // Auto-sync inhabitants
      if (activeType === "changes") {
        const { changeType, subject, quantity } = formData;
        const qty = quantity ? parseInt(quantity) : 1;
        if (changeType === "Added" && subject)                            await addOrUpdateInhabitant(subject, qty, date);
        if (REMOVE_CHANGE_TYPES.includes(changeType) && subject)         await patchInhabitantCount(subject, -qty);
      }
      if (activeType === "medical" && formData.outcome === "Died" && formData.fish) {
        await patchInhabitantCount(formData.fish, -(parseInt(formData.count) || 1));
      }

      await fetchAll();
      setFormData({}); setNote(""); setDate(todayStr); setTime(nowTime); setShowForm(false);
    } catch (err) {
      setError("Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete entry ──
  const deleteEntry = async (id) => {
    try {
      await apiFetch(`/api/entries/${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {
      setError("Failed to delete entry.");
    }
  };

  // ── Inhabitants CRUD ──
  const addInhabitant = async (data) => {
    setSavingInh(true);
    try {
      const row = await apiFetch("/api/inhabitants", { method: "POST", body: JSON.stringify(data) });
      setInhabitants(prev => [...prev, row]);
      setShowAddInh(false);
    } catch { setError("Failed to add inhabitant."); }
    finally { setSavingInh(false); }
  };

  const updateInhabitant = async (id, data) => {
    setSavingInh(true);
    try {
      const row = await apiFetch(`/api/inhabitants/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      setInhabitants(prev => prev.map(i => i.id === id ? row : i));
      setEditingInh(null);
    } catch { setError("Failed to update inhabitant."); }
    finally { setSavingInh(false); }
  };

  const deleteInhabitant = async (id) => {
    try {
      await apiFetch(`/api/inhabitants/${id}`, { method: "DELETE" });
      setInhabitants(prev => prev.filter(i => i.id !== id));
    } catch { setError("Failed to remove inhabitant."); }
  };

  const filtered   = filterType === "all" ? entries : entries.filter(e => e.type === filterType);
  const totalCount = inhabitants.reduce((s, i) => s + (i.count ?? 1), 0);
  const medOpen    = entries.filter(e => e.type === "medical" && e.data?.outcome === "Still in treatment");

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Georgia', serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
        input:focus, select:focus, textarea:focus { border-color:#0891b2 !important; background:#fff !important; outline:none; }
        button { transition: opacity 0.15s; }
        button:hover { opacity: 0.75; }
        button:disabled { cursor: default; }
      `}</style>

      {error && (
        <div style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca", padding: "10px 24px", fontSize: "13px", color: "#b91c1c", fontFamily: "'DM Sans', sans-serif", display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontSize: "16px" }}>×</button>
        </div>
      )}

      <div style={{ maxWidth: "1060px", margin: "0 auto", padding: "40px 24px 80px", display: "flex", gap: "36px", alignItems: "flex-start" }}>

        {/* ── Journal ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div>
                <h1 style={{ fontFamily: "'Lora', serif", fontSize: "26px", fontWeight: 400, color: "#0f172a", margin: "0 0 3px", letterSpacing: "-0.02em" }}>75g Tank Journal</h1>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                  Freshwater planted · {entries.length} entries
                  {medOpen.length > 0 && <span style={{ marginLeft: "8px", color: "#dc2626", fontWeight: 500 }}>· {medOpen.length} in treatment</span>}
                </p>
              </div>
              <button onClick={() => setShowForm(!showForm)} style={{
                background: showForm ? "#f1f5f9" : "#0891b2",
                color: showForm ? "#64748b" : "#fff",
                border: "none", borderRadius: "7px", padding: "8px 16px",
                fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>{showForm ? "Cancel" : "+ Add Entry"}</button>
            </div>
          </div>

          {/* Entry form */}
          {showForm && (
            <div style={{ background: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "20px", marginBottom: "28px", animation: "fadeIn 0.2s ease" }}>
              <div style={{ display: "flex", gap: "5px", marginBottom: "16px", flexWrap: "wrap" }}>
                {Object.entries(ENTRY_TYPES).map(([key, t]) => (
                  <button key={key} onClick={() => { setActiveType(key); setFormData({}); }} style={{
                    padding: "5px 12px", borderRadius: "5px", fontSize: "11px", fontWeight: 500,
                    border: "1px solid", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    background: activeType === key ? t.color : "transparent",
                    color: activeType === key ? "#fff" : "#64748b",
                    borderColor: activeType === key ? t.color : "#e2e8f0",
                  }}>{t.icon} {t.label}</button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
                  <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Date</span>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "3px", width: "90px" }}>
                  <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Time</span>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                </label>
              </div>

              <div style={{ marginBottom: "12px" }}>
                {activeType === "parameters"   && <ParametersForm data={formData} setData={setFormData} />}
                {activeType === "changes"      && <ChangesForm    data={formData} setData={setFormData} />}
                {activeType === "medical"      && <MedicalForm    data={formData} setData={setFormData} inhabitants={inhabitants} />}
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>
                  {activeType === "observations" ? "Observation *" : "Notes"}
                </span>
                <textarea rows={2} placeholder={activeType === "observations" ? "What did you notice?" : "Any additional notes…"} value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }} />
              </label>

              {activeType === "changes" && formData.changeType === "Added" && formData.subject && (
                <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#059669", fontFamily: "'DM Sans', sans-serif" }}>⬡ Will auto-add "{formData.subject}" to inhabitants.</p>
              )}
              {activeType === "changes" && REMOVE_CHANGE_TYPES.includes(formData.changeType) && formData.subject && (
                <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#dc2626", fontFamily: "'DM Sans', sans-serif" }}>⬡ Will update count for "{formData.subject}" in inhabitants.</p>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
                <button onClick={handleSubmit} disabled={saving} style={{
                  background: ENTRY_TYPES[activeType].color, color: "#fff",
                  border: "none", borderRadius: "6px", padding: "8px 20px",
                  fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  opacity: saving ? 0.6 : 1,
                }}>{saving ? "Saving…" : "Save Entry"}</button>
              </div>
            </div>
          )}

          {/* Filter pills */}
          <div style={{ display: "flex", gap: "5px", marginBottom: "4px", flexWrap: "wrap" }}>
            {[["all","All"], ...Object.entries(ENTRY_TYPES).map(([k,v]) => [k, v.label])].map(([key, label]) => (
              <button key={key} onClick={() => setFilterType(key)} style={{
                padding: "3px 11px", borderRadius: "20px", fontSize: "11px", border: "1px solid", cursor: "pointer",
                background: filterType === key ? "#0f172a" : "transparent",
                color: filterType === key ? "#fff" : "#94a3b8",
                borderColor: filterType === key ? "#0f172a" : "#e2e8f0",
                fontFamily: "'DM Sans', sans-serif",
              }}>{label}</button>
            ))}
          </div>

          {/* Entries */}
          <div>
            {loading && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#cbd5e1", fontFamily: "'DM Sans', sans-serif", fontSize: "14px" }}>Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#cbd5e1", fontFamily: "'DM Sans', sans-serif", fontSize: "14px" }}>No entries yet.</div>
            )}
            {filtered.map(entry => <EntryCard key={entry.id} entry={entry} onDelete={deleteEntry} />)}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ width: "230px", flexShrink: 0, position: "sticky", top: "40px" }}>

          {medOpen.length > 0 && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 14px", marginBottom: "12px", animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "6px" }}>✚ In treatment</div>
              {medOpen.map(e => (
                <div key={e.id} style={{ fontSize: "12px", color: "#7f1d1d", fontFamily: "'DM Sans', sans-serif", marginBottom: "2px" }}>
                  {e.data.fish}{e.data.count && e.data.count !== "1" ? ` × ${e.data.count}` : ""}
                  <span style={{ color: "#fca5a5", marginLeft: "4px" }}>— {e.data.symptoms || "treatment ongoing"}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: "#fafafa", border: "1px solid #f1f5f9", borderRadius: "12px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: "15px", color: "#0f172a", fontWeight: 400 }}>Inhabitants</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                  {inhabitants.length} species · {totalCount} total
                </div>
              </div>
              <button onClick={() => { setShowAddInh(!showAddInh); setEditingInh(null); }} style={{
                background: "none", border: "1px solid #e2e8f0", borderRadius: "5px",
                padding: "3px 9px", fontSize: "12px", color: "#64748b", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", lineHeight: "1.5",
              }}>+</button>
            </div>

            {showAddInh && (
              <InhabitantForm saving={savingInh} onSave={addInhabitant} onCancel={() => setShowAddInh(false)} />
            )}
            {editingInh && (
              <InhabitantForm saving={savingInh} initial={editingInh}
                onSave={data => updateInhabitant(editingInh.id, data)}
                onCancel={() => setEditingInh(null)}
              />
            )}

            {!loading && inhabitants.length === 0 && !showAddInh && (
              <div style={{ fontSize: "12px", color: "#cbd5e1", fontFamily: "'DM Sans', sans-serif", textAlign: "center", padding: "20px 0" }}>No inhabitants yet</div>
            )}

            {inhabitants.map(inh => (
              <InhabitantRow key={inh.id} inh={inh}
                onEdit={i => { setEditingInh(i); setShowAddInh(false); }}
                onDelete={deleteInhabitant}
              />
            ))}

            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "10px", color: "#cbd5e1", fontFamily: "'DM Sans', sans-serif", lineHeight: "1.5" }}>
                Auto-updates from Plant / Livestock and Medical entries.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
