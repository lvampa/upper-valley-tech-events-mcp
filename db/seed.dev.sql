-- Sample events for LOCAL DEVELOPMENT ONLY.
-- Applied by `npm run db:seed:local`; never runs against production (deploys
-- only apply migrations). Gives GET /events realistic data to develop against.
INSERT OR IGNORE INTO events
  (id, date, title, location, time, rsvp_href, meta, agenda, attendees, status)
VALUES
  ('jun-2025', '2025-06-18', 'June Meetup: Local LLMs', 'Lebanon, NH', '6:30 PM', NULL,
   '["Doors 6:30","Talks 7:00"]',
   '[{"time":"7:05","description":"Running models on the edge"}]',
   '18 here', 'scheduled'),
  ('jul-2025', '2025-07-16', 'Lightning Talks', 'Hanover, NH', '6:30 PM', 'https://example.com/rsvp',
   '["5-minute talks"]',
   '[{"time":"7:00","speaker":"open","description":"Sign up at the door","open":true}]',
   NULL, 'scheduled'),
  ('may-2025', '2025-05-21', 'May Meetup: Cloudflare Workers', 'Lebanon, NH', '6:30 PM', NULL,
   NULL, NULL, '24 attended', 'cancelled');
