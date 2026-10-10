-- Migration 0005 — private calendar feeds (AquaSlog 1.1.1)
--
-- One optional row per user who created a calendar subscription link
-- (/cal/<token>.ics). The URL token itself is never stored:
--   token      = base64url(HMAC-SHA256(REMINDER_SIGNING_SECRET, "aquaslog-calendar-feed:v1:" || token_nonce))
--   token_hash = hex(SHA-256(token))   -- the feed route looks rows up by this
-- so the token is not derivable from the user id or from the database alone, and
-- "Reset link" just replaces token_nonce + token_hash (the old URL 404s at once).
--
-- Additive only: a new table, nothing existing is altered. Users without a row
-- simply have no calendar link.

CREATE TABLE IF NOT EXISTS calendar_feeds (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_nonce TEXT NOT NULL,                      -- random 32 bytes (hex)
  token_hash  TEXT NOT NULL UNIQUE,               -- hex SHA-256 of the URL token
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))  -- last created/reset
);
