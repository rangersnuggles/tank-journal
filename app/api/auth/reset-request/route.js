export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/lib/db";
import { generateSessionToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";

function resetEmail(resetUrl) {
  const html = `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
            <h1 style="font-size: 28px; font-weight: 400; margin: 0 0 8px; font-family: serif;">AquaSlog</h1>
            <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">Password reset request</p>
            <p style="font-size: 15px; margin: 0 0 24px;">Click the button below to set a new password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">Reset password</a>
            <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `;
  const text = [
    "AquaSlog — password reset request",
    "",
    "Open this link to set a new password (expires in 1 hour):",
    resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");
  return { html, text };
}

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) return Response.json({ error: "Email is required" }, { status: 400 });

    const db = getDB();
    const user = await db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .bind(email.toLowerCase())
      .first();

    // Always return success to avoid leaking whether an email is registered
    if (!user) return Response.json({ ok: true });

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Clear any existing reset tokens for this user then insert new one
    await db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(user.id).run();
    await db
      .prepare(`INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)`)
      .bind(token, user.id, expiresAt)
      .run();

    const resetUrl = `${new URL(request.url).origin}/reset-password?token=${token}`;
    const { html, text } = resetEmail(resetUrl);

    try {
      await sendEmail(getRequestContext().env, {
        to: email,
        subject: "Reset your AquaSlog password",
        html,
        text,
        idempotencyKey: `password-reset/${token}`,
      });
    } catch (err) {
      // Don't surface delivery failures to the client: a 500 here (only for
      // registered emails) would leak which addresses have accounts.
      console.error("reset-request: email send failed:", err?.message);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("reset-request error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
