const sansFamily = "'DM Sans', sans-serif";
const serifFamily = "'Lora', serif";

export const metadata = { title: "Privacy Policy — AquaSlog" };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: "680px", margin: "60px auto", padding: "0 24px 80px", fontFamily: sansFamily }}>
      <a href="/" style={{ fontSize: "12px", color: "var(--color-text-subtle)", textDecoration: "none", display: "block", marginBottom: "32px" }}>← AquaSlog</a>

      <h1 style={{ fontFamily: serifFamily, fontSize: "28px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Privacy Policy</h1>
      <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 36px" }}>Effective January 1, 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px", fontSize: "14px", color: "var(--color-text-body)", lineHeight: "1.7" }}>
        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>What we collect</h2>
          <p style={{ margin: 0 }}>AquaSlog collects the email address and password you provide when creating an account. We also store the tank and journal entry data you create while using the service.</p>
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
          <p style={{ margin: 0 }}>AquaSlog uses PostHog to collect anonymized usage analytics — page views and feature interactions. No personally identifiable information is sent to PostHog beyond what is inherent in normal web traffic (such as IP address). We use this data solely to understand how the app is used and to improve it. You can opt out by enabling "Do Not Track" in your browser.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Your rights</h2>
          <p style={{ margin: 0 }}>You can delete your account and all associated data at any time from your tank settings. To request data export or ask questions, contact us at hello@aquaslog.com.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: serifFamily, fontSize: "18px", fontWeight: 400, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Changes</h2>
          <p style={{ margin: 0 }}>We may update this policy occasionally. Continued use of AquaSlog after changes constitutes acceptance of the updated policy.</p>
        </section>
      </div>
    </div>
  );
}
