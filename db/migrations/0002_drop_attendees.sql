-- Attendance counts are no longer shown on the site.

ALTER TABLE events DROP COLUMN attendees;
