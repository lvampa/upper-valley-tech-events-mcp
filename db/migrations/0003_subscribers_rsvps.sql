-- Mailing-list signups and event RSVPs from the public site. Emails are stored lower-cased.

CREATE TABLE IF NOT EXISTS subscribers (
  email       TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rsvps (
  event_id    TEXT NOT NULL REFERENCES events(id),
  email       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, email)
);
