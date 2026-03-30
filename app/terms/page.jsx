const sansFamily = "'DM Sans', sans-serif";
const serifFamily = "'Lora', serif";

export const metadata = { title: "Terms of Use — AquaSlog" };

export default function TermsPage() {
  return (
    <div style={{ maxWidth: "680px", margin: "60px auto", padding: "0 24px 80px", fontFamily: sansFamily }}>
      <a href="/" style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none", display: "block", marginBottom: "32px" }}>← AquaSlog</a>

      <h1 style={{ fontFamily: serifFamily, fontSize: "28px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Terms of Use</h1>
      <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 36px" }}>Effective January 1, 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px", fontSize: "14px", color: "var(--color-text-body)", lineHeight: "1.7" }}>
        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Use of the service</h2>
          <p style={{ margin: 0 }}>AquaSlog is a personal aquarium journaling tool. You may use it to track your tanks, water parameters, inhabitants, and related notes. You are responsible for the accuracy of the data you enter.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Your content</h2>
          <p style={{ margin: 0 }}>You retain ownership of all journal entries and data you create. By making a tank public, you grant AquaSlog a non-exclusive license to display that content at its public URL. You can revoke this at any time by marking the tank private or deleting it.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Acceptable use</h2>
          <p style={{ margin: 0 }}>Do not use AquaSlog to store illegal content, attempt to access other users' data, or interfere with the service. Accounts found in violation may be terminated.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Disclaimer</h2>
          <p style={{ margin: 0 }}>AquaSlog is provided as-is. We make no guarantees of uptime or data retention, though we do our best to keep things running. Always keep your own backups of important information.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Contact</h2>
          <p style={{ margin: 0 }}>Questions? Reach us at hello@aquaslog.com.</p>
        </section>
      </div>
    </div>
  );
}
