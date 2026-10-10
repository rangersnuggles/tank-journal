# AquaSlog

An open source freshwater aquarium journal. Track water parameters, inhabitants, plant and livestock changes, medical events, and CO₂ across multiple tanks. Public tank pages let you share your setup with others.

**Live at [aquaslog.com](https://aquaslog.com)**

## Features

- Journal entries for water parameters, changes, observations, medical events, and CO₂
- Inhabitants sidebar that auto-syncs from your entries
- Fish, invertebrate and plant name autocomplete (your tank, your past names, and a species catalog)
- Maintenance reminders ("water change every 6 weeks") that reset when you log the task, with an optional daily email digest, a private calendar subscription feed (Apple/Google/Outlook) and per-reminder "Add to calendar" downloads
- Water parameter trend charts and an at-a-glance status strip (latest readings, CO₂, treatments)
- Public read-only tank pages at `/t/:username/:slug`, with link previews and a sitemap
- Account settings, full data export (JSON/CSV), and self-serve account deletion
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
# 1. Apply pending migrations (1.1.1 adds 0005_calendar.sql) BEFORE deploying the app
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

### Calendar feed

On `/account/notifications` → **Calendar**, a user can create a private subscription link,
`/cal/<token>.ics` (public route; the token is the credential). It is an RFC 5545 feed
(`lib/calendar/ics.js`, tests in `tests/ics.test.mjs`) with one all-day event per *active*
reminder on its **next** due date — no RRULEs, because due dates move when the task is
logged; the feed always shows the current next occurrence (stable `UID`
`reminder-<id>@aquaslog.com`, `SEQUENCE`/`LAST-MODIFIED` from `updated_at`, a 9 AM display
alarm). Overdue reminders stay on their past due date with an `Overdue: ` prefix (decided
at feed generation in the user's timezone). Paused and completed reminders are left out.

- Tokens (migration `0005_calendar.sql`, table `calendar_feeds`): the URL token is
  `HMAC-SHA256(REMINDER_SIGNING_SECRET, random nonce)`; only the nonce and the token's
  SHA-256 are stored, and the feed is looked up by that hash (one indexed query; malformed
  tokens never hit the DB). **Reset link** replaces the nonce, so the old URL 404s at once.
  Rotating `REMINDER_SIGNING_SECRET` changes every calendar URL.
- Responses: `text/calendar; charset=utf-8`, `Cache-Control: private, max-age=900`,
  `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` of 6 h. Unknown/revoked tokens get a bare 404.
  Google Calendar refreshes subscriptions every ~8–24 h regardless; Apple is faster.
- Per reminder, the ⋯ menu's **Add to calendar** downloads a one-event `.ics`
  (`GET /api/reminders/<id>/ics`, owner only) whose UID includes the due date, so it never
  collides with the subscribed copy.
- The JSON export says whether a calendar link exists (dates only — never the token).

Try it locally: log in as the demo user, open `/account/notifications`, **Create calendar
link**, then `curl -i "$(pbpaste)"` after **Copy** (or paste the URL into a calendar app
that can reach `localhost`).

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
