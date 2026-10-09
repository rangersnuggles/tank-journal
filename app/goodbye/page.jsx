import Link from "next/link";

export const metadata = { title: "Account deleted — AquaSlog" };

const sansFamily = "'DM Sans', sans-serif";

export default function GoodbyePage() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", fontFamily: sansFamily }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "60px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'VT323', monospace", fontSize: 44, fontWeight: 400, margin: "0 0 12px", color: "var(--color-text-primary)" }}>
          So long, and thanks for all the fish
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-body)", lineHeight: 1.65, margin: "0 0 8px" }}>
          Your AquaSlog account, tanks, journal entries and inhabitants have been permanently deleted,
          and you&apos;ve been signed out everywhere.
        </p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.65, margin: "0 0 28px" }}>
          Public tank pages you had are gone too. Happy fishkeeping.
        </p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
          <Link href="/register" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Create a new account</Link>
          {" · "}
          <Link href="/login" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
