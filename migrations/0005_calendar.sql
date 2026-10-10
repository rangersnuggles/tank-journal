-- Migration 0005 — private calendar feeds (AquaSlog 1.1.1)
--
-- One optional row per user who created a calendar subscription link
-- (/cal/<token>.ics). The URL token itself is never stored:
--   token      = base64url(HMAC-SHA256(REMINDER_SIGNING_SECRET, "aquaslog-calendar-feed:v1:" || token_nonce))
--   token_hash = hex(SHA-256(token))   -- the feed route looks rows up by this
-- so the token is not derivable from the user id or from the database alone, and
-- "Reset link" just replaces token_nonce + token_hash (the old URL 404s at once).
--
-- Additive only: a new table plus two defaulted columns on user_settings for the
-- calendar alert (applies to the feed and to single-event downloads). Users without
-- a calendar_feeds row simply have no calendar link.

CREATE TABLE IF NOT EXISTS calendar_feeds (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_nonce TEXT NOT NULL,                      -- random 32 bytes (hex)
  token_hash  TEXT NOT NULL UNIQUE,               -- hex SHA-256 of the URL token
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))  -- last created/reset
);

-- Calendar alert: 'HH:MM' in the user's local time, or 'none' for no alert;
-- day 0 = on the due date, -1 = the day before.
ALTER TABLE user_settings ADD COLUMN calendar_alert_time TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE user_settings ADD COLUMN calendar_alert_day INTEGER NOT NULL DEFAULT 0 CHECK (calendar_alert_day IN (0, -1));
