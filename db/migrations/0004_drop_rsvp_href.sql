-- RSVPs happen on the site through POST /events/:id/rsvp, so events no longer link out.

ALTER TABLE events DROP COLUMN rsvp_href;
