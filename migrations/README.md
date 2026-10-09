# D1 migrations

`migrations/` is the source of truth for the AquaSlog schema (`schema.sql` is a
v1.0 reference snapshot only). Files are applied in filename order by
`wrangler d1 migrations apply`, which records applied files in `d1_migrations`.

| File | Purpose | Status |
| --- | --- | --- |
| `0001_baseline.sql` | v1.0 schema (all `CREATE … IF NOT EXISTS`, safe on the existing prod DB) | done |
| `0002_email_outbox.sql` | local email capture for `EMAIL_MODE=log` (`/dev/outbox`) | done |
| `0003_reminders.sql` | reminders, reminder_log, user_settings, reminder_digests | done |
| `0004_species.sql` | species catalog (generated from Wikidata by `scripts/species/build-species.mjs`) + `inhabitants.species_id` | done |
| `0005_account.sql` | not needed (account features required no schema change) | unused |

Rules:

- Never edit a migration after it has been applied anywhere; add a new file.
- Prefer additive, idempotent statements (`IF NOT EXISTS`). D1 runs each file in
  a transaction, so do not include `BEGIN`/`COMMIT`.

Local commands:

```bash
npm run db:migrate:local   # apply pending migrations to the local D1 (.wrangler/state)
npm run db:seed:local      # (re)create the demo account + synthetic data
npm run db:reset:local     # wipe .wrangler/state, migrate, seed
```
