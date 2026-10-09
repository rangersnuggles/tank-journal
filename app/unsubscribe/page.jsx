export const runtime = "edge";
export const dynamic = "force-dynamic";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { safeVerifyToken } from "@/lib/reminders/tokens";
import { getUserSettings } from "@/lib/reminders/service";
import { EmailPageShell, UnsubscribeConfirm } from "@/components/ReminderEmailAction";

export const metadata = { title: "Unsubscribe — AquaSlog", robots: { index: false } };

// Confirm page for the unsubscribe link in reminder emails. GET never unsubscribes;
// the button POSTs to /api/email/unsubscribe (mail-client one-click POSTs there too).
export default async function UnsubscribePage(props) {
  const { t } = await props.searchParams;
  const tok = t ? await safeVerifyToken(getRequestContext().env, String(t)) : { ok: false };
  if (!tok.ok || tok.action !== "unsubscribe") {
    return (
      <EmailPageShell title={tok.reason === "expired" ? "This link has expired" : "This link isn’t valid"}>
        You can turn reminder emails off any time in your AquaSlog email settings.
      </EmailPageShell>
    );
  }
  const db = getDB();
  const user = await db.prepare(`SELECT email FROM users WHERE id = ?`).bind(tok.userId).first();
  if (!user) return <EmailPageShell title="Account not found">There’s nothing to unsubscribe.</EmailPageShell>;
  const settings = await getUserSettings(db, tok.userId);
  const [local, domain] = user.email.split("@");
  const masked = `${local.slice(0, 1)}${"•".repeat(Math.max(1, Math.min(local.length - 1, 6)))}@${domain}`;
  return <UnsubscribeConfirm token={String(t)} maskedEmail={masked} alreadyOff={!settings.reminders_email} />;
}
