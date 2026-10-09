const sansFamily = "'DM Sans', sans-serif";
const serifFamily = "'Lora', serif";

export const metadata = { title: "Privacy Policy — AquaSlog" };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: "680px", margin: "60px auto", padding: "0 24px 80px", fontFamily: sansFamily }}>
      <a href="/" style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none", display: "block", marginBottom: "32px" }}>← AquaSlog</a>

      <h1 style={{ fontFamily: serifFamily, fontSize: "28px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Privacy Policy</h1>
      <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 36px" }}>Effective January 1, 2026 · Last updated October 9, 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px", fontSize: "14px", color: "var(--color-text-body)", lineHeight: "1.7" }}>
        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>What we collect</h2>
          <p style={{ margin: 0 }}>AquaSlog collects the email address, username, optional display name and password you provide when creating an account. We also store the tank, journal entry and inhabitant data you create while using the service.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>How we use it</h2>
          <p style={{ margin: 0 }}>Your data is used solely to operate AquaSlog — to authenticate you, display your tanks and journal entries, and (if you opt in) make your public tank pages viewable by others. We do not sell or share your data with third parties.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Data storage</h2>
          <p style={{ margin: 0 }}>Data is stored on Cloudflare's infrastructure. Passwords are hashed and never stored in plain text. Sessions are secured with HttpOnly cookies.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Analytics</h2>
          <p style={{ margin: "0 0 10px" }}>AquaSlog uses PostHog to collect pseudonymous usage analytics — page views and feature interactions (for example, "entry created"). When you're signed in, these events are linked to an opaque account number, never to your email address, username or display name. No other personal information is sent to PostHog beyond what is inherent in normal web traffic (such as IP address and browser type), and password-reset links are masked before anything is sent. We use this data solely to understand how the app is used and to improve it.</p>
          <p style={{ margin: 0 }}>We respect your browser's "Do Not Track" and Global Privacy Control settings: if either is on, AquaSlog doesn't load analytics at all.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Your rights</h2>
          <p style={{ margin: "0 0 10px" }}><strong style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>Export:</strong> you can download a copy of all your data at any time from your <a href="/account" style={{ color: "var(--color-accent)", textDecoration: "none" }}>account page</a> — everything as JSON, or each tank's journal as a CSV spreadsheet.</p>
          <p style={{ margin: "0 0 10px" }}><strong style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>Correction:</strong> you can change your display name, username, email address and password on your account page.</p>
          <p style={{ margin: "0 0 10px" }}><strong style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>Deletion:</strong> you can delete your account from your <a href="/account" style={{ color: "var(--color-accent)", textDecoration: "none" }}>account page</a>. This immediately and permanently removes your account, tanks, journal entries, inhabitants and sessions from our database and takes down your public tank pages. Pseudonymous analytics events are not linked to your email or username; to have them removed too, contact us with your username before deleting your account.</p>
          <p style={{ margin: 0 }}>Questions? Contact us at hello@aquaslog.com.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Changes</h2>
          <p style={{ margin: 0 }}>We may update this policy occasionally. Continued use of AquaSlog after changes constitutes acceptance of the updated policy.</p>
        </section>
      </div>
    </div>
  );
}
