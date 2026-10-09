# AquaSlog

An open source freshwater aquarium journal. Track water parameters, inhabitants, plant and livestock changes, medical events, and CO₂ across multiple tanks. Public tank pages let you share your setup with others.

**Live at [aquaslog.com](https://aquaslog.com)**

## Features

- Journal entries for water parameters, changes, observations, medical events, and CO₂
- Inhabitants sidebar that auto-syncs from your entries
- Public read-only tank pages at `/t/:username/:slug`
- Dark mode
- Password reset via email

## Stack

- [Next.js 15](https://nextjs.org) (App Router)
- [Cloudflare Pages](https://pages.cloudflare.com) + [D1](https://developers.cloudflare.com/d1/) (SQLite at the edge)
- [Resend](https://resend.com) for transactional email
- [PostHog](https://posthog.com) for analytics

## Local Development

```bash
npm install
npm run db:reset:local   # local D1: wipe, apply migrations/, seed demo data
npm run dev
```

Log in as `demo@aquaslog.local` / `aquaslog-demo` (synthetic data; a second account,
`viewer@aquaslog.local`, has no tanks). `next dev` and `wrangler d1 … --local` share
the same local D1 under `.wrangler/state`.

Email: with `EMAIL_MODE=log` in `.env.local` (or no `RESEND_API_KEY`), nothing is sent —
emails are captured to the local `email_outbox` table and shown at
[`/dev/outbox`](http://localhost:3000/dev/outbox) (dev only). Set `RESEND_API_KEY` to send
for real. PostHog is optional (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`).

## Deployment

Hosted on Cloudflare Pages. Deploy manually:

```bash
npm run pages:build && npm run pages:deploy
```

Git push alone does not deploy.

## Database

Schema lives in `migrations/` (see `migrations/README.md`); `schema.sql` is a v1.0 reference snapshot. To run a query against the remote D1 database:

```bash
npx wrangler d1 execute tank-journal-db --remote --command="SELECT * FROM users"
```
