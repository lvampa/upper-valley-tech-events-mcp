import { type Env } from '@/types.ts';
// Import the canonical migration DDL as a raw string so the test schema can't
// drift from production. (Typed via ./sql.d.ts's `*.sql?raw` declaration.)
import init from '../db/migrations/0001_init.sql?raw';
import dropAttendees from '../db/migrations/0002_drop_attendees.sql?raw';
import subscribersRsvps from '../db/migrations/0003_subscribers_rsvps.sql?raw';

const migrations = [init, dropAttendees, subscribersRsvps];

export async function resetDb(env: Env): Promise<void> {
  // rsvps references events, so it has to go first.
  await env.DB.exec('DROP TABLE IF EXISTS rsvps');
  await env.DB.exec('DROP TABLE IF EXISTS subscribers');
  await env.DB.exec('DROP TABLE IF EXISTS events');
  await env.DB.exec('DROP TABLE IF EXISTS organizers');
  for (const stmt of migrations
    .join(';')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
}

export async function seedOrganizer(env: Env, email: string): Promise<void> {
  await env.DB.prepare('INSERT OR REPLACE INTO organizers (email, added_by) VALUES (?, ?)')
    .bind(email.toLowerCase(), 'test')
    .run();
}

interface SeedEvent {
  id: string;
  date: string;
  title?: string;
  location?: string;
  time?: string;
  meta?: string[];
  agenda?: unknown[];
  status?: string;
}
export async function seedEvent(env: Env, e: SeedEvent): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO events (id, date, title, location, time, rsvp_href, meta, agenda, status)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  )
    .bind(
      e.id,
      e.date,
      e.title ?? e.id,
      e.location ?? 'Lebanon, NH',
      e.time ?? '6:30 PM',
      e.meta ? JSON.stringify(e.meta) : null,
      e.agenda ? JSON.stringify(e.agenda) : null,
      e.status ?? 'scheduled',
    )
    .run();
}
