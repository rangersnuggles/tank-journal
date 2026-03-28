-- ─────────────────────────────────────────────────────────────────────────────
-- Tank Journal — D1 Schema (SQLite)
-- Apply: wrangler d1 execute tank-journal-db --file=schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,       -- URL-safe slug, used in public URLs (/t/username/...)
  display_name  TEXT,
  password_hash TEXT NOT NULL,              -- "iterations:saltBase64:hashBase64" (PBKDF2-SHA256)
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,              -- 32-byte random hex token stored in HttpOnly cookie
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,                 -- ISO8601 datetime
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS tanks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  slug        TEXT,                         -- URL-safe, unique per user (null = no public page)
  is_public   INTEGER NOT NULL DEFAULT 0,  -- 0=private, 1=public
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slug)
);
CREATE INDEX IF NOT EXISTS tanks_user_idx ON tanks(user_id);
CREATE INDEX IF NOT EXISTS tanks_slug_idx ON tanks(slug);

CREATE TABLE IF NOT EXISTS inhabitants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tank_id    INTEGER NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  count      INTEGER,
  date_added TEXT NOT NULL DEFAULT (date('now')),
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS inhabitants_tank_idx ON inhabitants(tank_id);

CREATE TABLE IF NOT EXISTS entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tank_id    INTEGER NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,                 -- 'parameters'|'changes'|'observations'|'medical'|'co2'
  date       TEXT NOT NULL,
  time       TEXT NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',   -- JSON stored as TEXT (D1 has no jsonb)
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS entries_tank_date_idx ON entries(tank_id, date DESC, created_at DESC);
