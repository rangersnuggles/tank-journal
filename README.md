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
npm run dev
```

Requires a `.env.local` with `RESEND_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, and `NEXT_PUBLIC_POSTHOG_HOST`. D1 is available locally via `wrangler` — see `wrangler.toml`.

## Deployment

Hosted on Cloudflare Pages. Deploy manually:

```bash
npm run pages:build && npm run pages:deploy
```

Git push alone does not deploy.

## Database

Schema is in `schema.sql`. To run a query against the remote D1 database:

```bash
npx wrangler d1 execute tank-journal-db --remote --command="SELECT * FROM users"
```
