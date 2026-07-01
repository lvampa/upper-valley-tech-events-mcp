-- Events service schema.

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,         -- e.g. "jul-2025"
  date        TEXT NOT NULL,            -- ISO "YYYY-MM-DD"
  title       TEXT NOT NULL,
  location    TEXT NOT NULL,
  time        TEXT NOT NULL,            -- display time, e.g. "6:30 PM"
  rsvp_href   TEXT,
  meta        TEXT,                     -- JSON array of strings
  agenda      TEXT,                     -- JSON array of { time, speaker?, description, open? }
  attendees   TEXT,                     -- past events only, e.g. "12 here"
  status      TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled' | 'cancelled'
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (date);

-- Organizers allowed to write via the MCP tools. Gated by Google login email.
CREATE TABLE IF NOT EXISTS organizers (
  email       TEXT PRIMARY KEY,
  added_by    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
