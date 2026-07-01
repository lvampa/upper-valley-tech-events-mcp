-- Bootstrap the first organizer. Run once after the schema migration.
-- Additional organizers are added via the `add_organizer` MCP tool once
-- connected, or with a direct D1 insert. Emails are stored lower-cased.
INSERT OR IGNORE INTO organizers (email, added_by) VALUES
  ('uppervalleytechnology@gmail.com', 'seed');
