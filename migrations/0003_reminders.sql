-- Migration 0003 — reminders (AquaSlog 1.1)
--
-- Per-tank maintenance reminders ("water change every 6 weeks"), an audit log of
-- what moved them, per-user notification settings, and a per-user/per-local-day
-- claim table that makes the email digest idempotent (one email per user per day,
-- even if the cron fires twice or two runners overlap).
--
-- Additive only. Code must tolerate a missing user_settings row (COALESCE to the
-- defaults below), so existing users need no backfill.

CREATE TABLE IF NOT EXISTS reminders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tank_id          INTEGER NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  task_type        TEXT NOT NULL
                   CHECK (task_type IN ('water_change','filter_clean','fertilizer','test_water','custom')),
  title            TEXT,                          -- required for 'custom'; optional label override otherwise
  interval_days    INTEGER                        -- NULL = one-off; else 1..365
                   CHECK (interval_days IS NULL OR (interval_days BETWEEN 1 AND 365)),
  due_date         TEXT NOT NULL,                 -- 'YYYY-MM-DD' in the user's local timezone
  auto_reset       INTEGER NOT NULL DEFAULT 1,    -- 1 = matching journal entries push the due date forward
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','completed')),
  last_done_on     TEXT,                          -- 'YYYY-MM-DD' (local) of the last completion
  last_notified_on TEXT,                          -- local date of the last digest that included it
  notify_count     INTEGER NOT NULL DEFAULT 0,    -- digests sent for the current due_date (nag throttle)
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS reminders_status_due_idx ON reminders(status, due_date);
CREATE INDEX IF NOT EXISTS reminders_tank_idx       ON reminders(tank_id);
CREATE INDEX IF NOT EXISTS reminders_user_idx       ON reminders(user_id);

CREATE TABLE IF NOT EXISTS reminder_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  reminder_id   INTEGER NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  action        TEXT NOT NULL CHECK (action IN ('done','snoozed','auto_reset','completed')),
  source        TEXT NOT NULL CHECK (source IN ('app','email','entry')),
  entry_id      INTEGER,                          -- journal entry that triggered/was created (no FK: entries can be deleted)
  prev_due_date TEXT,
  new_due_date  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS reminder_log_reminder_idx ON reminder_log(reminder_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone        TEXT NOT NULL DEFAULT 'UTC',    -- IANA name, e.g. 'America/New_York'
  reminders_email INTEGER NOT NULL DEFAULT 1,     -- 1 = send the daily reminder digest
  digest_hour     INTEGER NOT NULL DEFAULT 8      -- local hour (0..23) after which the digest may go out
                  CHECK (digest_hour BETWEEN 0 AND 23),
  unsubscribed_at TEXT,                           -- set by the email unsubscribe link
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminder_digests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date  TEXT NOT NULL,                      -- the user's local date the digest is for
  status      TEXT NOT NULL DEFAULT 'claimed'
              CHECK (status IN ('claimed','sent','failed','empty')),
  attempts    INTEGER NOT NULL DEFAULT 1,
  item_count  INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, local_date)
);
