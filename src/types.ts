// Shared shapes for the events service. Mirrors the website's Event type
// (src/lib/types.ts) so GET /events returns exactly what the site consumes.

export interface AgendaItem {
  time: string;
  speaker?: string;
  description: string;
  open?: boolean;
}

export interface EventRecord {
  id: string;
  date: string; // ISO "YYYY-MM-DD"
  title: string;
  location: string;
  time: string;
  rsvpHref?: string;
  meta?: string[];
  agenda?: AgendaItem[];
  attendees?: string;
}

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  COOKIE_ENCRYPTION_KEY?: string;
}

// Raw D1 row shape (snake_case, JSON columns as strings).
export interface EventRow {
  id: string;
  date: string;
  title: string;
  location: string;
  time: string;
  rsvp_href: string | null;
  meta: string | null;
  agenda: string | null;
  attendees: string | null;
  status: string;
}
