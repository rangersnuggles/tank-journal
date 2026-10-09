# AquaSlog

An open source freshwater aquarium journal. Track water parameters, inhabitants, plant and livestock changes, medical events, and CO₂ across multiple tanks. Public tank pages let you share your setup with others.

**Live at [aquaslog.com](https://aquaslog.com)**

## Features

- Journal entries for water parameters, changes, observations, medical events, and CO₂
- Inhabitants sidebar that auto-syncs from your entries
- Fish, invertebrate and plant name autocomplete (your tank, your past names, and a species catalog)
- Maintenance reminders ("water change every 6 weeks") that reset when you log the task, with an optional daily email digest
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

Optional public settings: `NEXT_PUBLIC_SITE_URL` (canonical origin for metadata/sitemap,
default `https://aquaslog.com`) and `NEXT_PUBLIC_SAMPLE_TANK_PATH` (the "live tank" link,
default `/t/robrob/75planted`; use `/t/demo/75planted` locally).

## Reminder emails

Reminders live in D1 (`migrations/0003_reminders.sql`). Logging a matching journal entry
(water change, "Filter cleaned", test results, "Fertilized") pushes the reminder's due date
forward. A daily digest email goes out from a separate scheduled Worker,
[`workers/reminders/`](workers/reminders) (Pages has no cron triggers), which shares the D1
database and the pure modules in `lib/reminders/` and `lib/email/` with the app.

Local review:

- On [`/dev/outbox`](http://localhost:3000/dev/outbox), **Run reminder digest now** generates
  digests into the outbox (tick "Ignore digest hour" to skip the per-user hour check, and
  "Forget today's digests" to re-send). Links in captured emails are clickable.
- Or run the real Worker locally against the same local D1, then trigger its cron:

  ```bash
  npm run worker:dev                                   # wrangler dev --test-scheduled on :8787
  curl "http://localhost:8787/__scheduled?cron=7+*+*+*+*"
  ```

  (Stop `next dev` first if you see SQLite lock errors — both use `.wrangler/state`.)

Signed email links use `REMINDER_SIGNING_SECRET`. In development (`next dev`, or
`npm run worker:dev`, which sets `AQUASLOG_DEV=1`) a clearly-marked insecure default is used;
production refuses to sign or verify without the secret.

Production (manual, one time — nothing deploys automatically):

```bash
# 1. Apply the migration
npx wrangler d1 migrations apply tank-journal-db --remote
# 2. Secrets: the same REMINDER_SIGNING_SECRET for the Pages project and the Worker
npx wrangler pages secret put REMINDER_SIGNING_SECRET --project-name=tank-journal
npx wrangler secret put REMINDER_SIGNING_SECRET --config workers/reminders/wrangler.toml
npx wrangler secret put RESEND_API_KEY --config workers/reminders/wrangler.toml
# 3. Deploy the Pages app as usual, then the Worker
npx wrangler deploy --config workers/reminders/wrangler.toml
```

The Worker runs hourly (`7 * * * *`) and sends each user at most one digest per local day,
after their chosen hour; `reminder_digests` makes runs idempotent. Overdue reminders are
re-sent after 3 and 6 days, then no more emails.

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

## Species data

The species catalog (`migrations/0004_species.sql`) is generated from
[Wikidata](https://www.wikidata.org) by `scripts/species/build-species.mjs`.
Species data from Wikidata, [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
Extra hobby names live in `scripts/species/aliases.json`. To refresh:

```bash
node scripts/species/build-species.mjs --refresh --stats
```

## License

AquaSlog is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). You're free to use, modify, and self-host it; if you run a modified version as a public service, you must make your source code available to its users.
