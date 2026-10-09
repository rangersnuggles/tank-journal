-- Migration 0002 — email_outbox
--
-- Local/dev capture of outgoing email. When EMAIL_MODE=log (or no RESEND_API_KEY
-- is configured), lib/email/send.js writes messages here instead of calling
-- Resend. Viewable in development at /dev/outbox.
-- Harmless in production: nothing writes to it while Resend is configured.

CREATE TABLE IF NOT EXISTS email_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addr         TEXT NOT NULL,              -- comma-separated recipients
  from_addr       TEXT NOT NULL,
  subject         TEXT NOT NULL,
  html            TEXT,
  text            TEXT,
  headers         TEXT NOT NULL DEFAULT '{}', -- JSON object of extra headers
  idempotency_key TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS email_outbox_created_idx ON email_outbox(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_idem_idx
  ON email_outbox(idempotency_key) WHERE idempotency_key IS NOT NULL;
