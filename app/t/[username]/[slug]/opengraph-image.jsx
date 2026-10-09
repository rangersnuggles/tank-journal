import { ImageResponse } from "next/og";
import { getPublicTank, fmtShortDate } from "@/lib/publicTank";

export const runtime = "edge";
export const alt = "A public aquarium journal kept with AquaSlog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Kept deliberately simple for next-on-pages: plain flexbox, no custom fonts
// (uses next/og's bundled default sans), no remote assets.
const BG = "#0f172a";
const ACCENT = "#22d3ee";
const MUTED = "#94a3b8";

function Stat({ value, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 56 }}>
      <div style={{ fontSize: 52, color: "#f1f5f9", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 22, color: MUTED, marginTop: 6, textTransform: "uppercase", letterSpacing: 2 }}>{label}</div>
    </div>
  );
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export default async function Image({ params }) {
  const { username, slug } = await params;
  const data = await getPublicTank(username, slug);
  if (!data) return new Response("Not found", { status: 404 });

  const { tank, stats } = data;
  const stat = [
    { value: String(stats.speciesCount), label: "species" },
    { value: String(stats.entryCount), label: stats.entryCount === 1 ? "entry" : "entries" },
    { value: String(stats.daysRunning), label: "days running" },
  ];

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: BG, padding: "64px 72px", color: "#f1f5f9",
        backgroundImage: "linear-gradient(135deg, #0f172a 0%, #0c3a4a 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 30, color: ACCENT, letterSpacing: 1 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: ACCENT, marginRight: 14 }} />
            AquaSlog
          </div>
          <div style={{ fontSize: 22, color: MUTED }}>Public tank journal</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: tank.name.length > 28 ? 64 : 80, lineHeight: 1.05, fontWeight: 700, letterSpacing: -1 }}>
            {truncate(tank.name, 48)}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: MUTED, marginTop: 14 }}>{`by ${truncate(tank.ownerName, 40)}`}</div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex" }}>
            {stat.map((s) => <Stat key={s.label} value={s.value} label={s.label} />)}
          </div>
          {stats.lastWaterChange && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ fontSize: 22, color: MUTED, textTransform: "uppercase", letterSpacing: 2 }}>Last water change</div>
              <div style={{ fontSize: 34, color: ACCENT, marginTop: 6 }}>{fmtShortDate(stats.lastWaterChange)}</div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
