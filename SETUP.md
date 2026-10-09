# AquaSlog — Setup Guide

> The original version of this guide described the pre-1.0 Supabase + Vercel stack
> and is obsolete. This is the current (v1.1) stack: **Next.js 15 on Cloudflare
> Pages + D1**. For day-to-day local development, see the [README](README.md).

## Prerequisites

- Node.js 20+
- A Cloudflare account (only needed to deploy or self-host; local dev runs entirely
  on your machine via Wrangler's local D1)

## Local development

```bash
npm install
npm run db:reset:local   # wipe .wrangler/state, apply migrations/, seed demo data
npm run dev              # http://localhost:3000
```

Sign in as `demo@aquaslog.local` / `aquaslog-demo`. Create `.env.local` with
`EMAIL_MODE=log` so emails are captured to the local `email_outbox` table
(viewable at `/dev/outbox`) instead of being sent.

## Self-hosting on Cloudflare

1. Create a D1 database and put its name/id in `wrangler.toml` (`[[d1_databases]]`,
   binding `DB`):

   ```bash
   npx wrangler d1 create <your-db-name>
   ```

2. Apply the schema (see `migrations/README.md`):

   ```bash
   npx wrangler d1 migrations apply <your-db-name> --remote
   ```

3. Create a Cloudflare Pages project and set its environment variables:

   | Variable | Required | Purpose |
   | --- | --- | --- |
   | `RESEND_API_KEY` | for email | Password-reset (and other) emails via [Resend](https://resend.com). Without it, emails are written to the `email_outbox` table instead of being sent. |
   | `EMAIL_FROM` | optional | Sender address for outgoing email. |
   | `EMAIL_MODE` | optional | `log` forces outbox capture even when a Resend key is set. |
   | `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | optional | Pseudonymous PostHog analytics (Do Not Track is respected). Leave unset to disable analytics. |

4. Build and deploy:

   ```bash
   npm run pages:build && npm run pages:deploy
   ```

## Account administration

Users manage their own account at `/account`: profile, email, password, data export
(JSON / per-tank CSV) and account deletion. A user who has forgotten their password
uses "Forgot password?" on the login page. If your deployment has no email provider,
the reset link is in the `email_outbox` table:

```bash
npx wrangler d1 execute <your-db-name> --remote \
  --command "SELECT to_addr, text FROM email_outbox ORDER BY id DESC LIMIT 5"
```
