-- Sample events for LOCAL DEVELOPMENT ONLY.
-- Applied by `npm run db:seed:local`; never runs against production (deploys
-- only apply migrations). Gives GET /events realistic data to develop against.
INSERT OR IGNORE INTO events
  (id, date, title, location, time, rsvp_href, meta, agenda, status)
VALUES
  ('jun-2025', '2025-06-18', 'June Meetup: Local LLMs', 'Lebanon, NH', '6:30 PM', NULL,
   '["Doors 6:30","Talks 7:00"]',
   '[{"time":"7:05","description":"Running models on the edge"}]',
   'scheduled'),
  ('jul-2025', '2025-07-16', 'Lightning Talks', 'Hanover, NH', '6:30 PM', 'https://example.com/rsvp',
   '["5-minute talks"]',
   '[{"time":"7:00","speaker":"open","description":"Sign up at the door","open":true}]',
   'scheduled'),
  ('may-2025', '2025-05-21', 'May Meetup: Cloudflare Workers', 'Lebanon, NH', '6:30 PM', NULL,
   NULL, NULL, 'cancelled'),
  ('nov-2026', '2026-11-18', 'November Meetup: Agents in Production', 'Lebanon, NH', '6:30-8:30 PM', 'https://example.com/rsvp',
   '["Doors 6:30","Talks 7:00"]',
   '[{"time":"7:00","speaker":"Sam Rivera","description":"What broke when we shipped an agent"},{"time":"7:30","description":"Open demos","open":true}]',
   'scheduled'),
  ('dec-2026', '2026-12-09', 'Holiday Social', 'White River Junction, VT', '6-8 PM', NULL,
   '["No talks, just food"]',
   NULL,
   'scheduled'),
  ('jan-2027', '2027-01-20', 'January Meetup: Self-Hosting', 'Hanover, NH', '6:30 PM', 'https://example.com/rsvp',
   NULL,
   '[{"time":"7:05","speaker":"open","description":"Lightning talks, sign up at the door","open":true}]',
   'scheduled');
