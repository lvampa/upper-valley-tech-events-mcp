import { type Env } from '@/types.ts';
// Import the canonical migration DDL as a raw string so the test schema can't
// drift from production. (Typed via ./sql.d.ts's `*.sql?raw` declaration.)
import schema from '../db/migrations/0001_init.sql?raw';

export async function resetDb(env: Env): Promise<void> {
  await env.DB.exec('DROP TABLE IF EXISTS events');
  await env.DB.exec('DROP TABLE IF EXISTS organizers');
  for (const stmt of schema
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
  attendees?: string;
  status?: string;
}
export async function seedEvent(env: Env, e: SeedEvent): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO events (id, date, title, location, time, rsvp_href, meta, agenda, attendees, status)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
  )
    .bind(
      e.id,
      e.date,
      e.title ?? e.id,
      e.location ?? 'Lebanon, NH',
      e.time ?? '6:30 PM',
      e.meta ? JSON.stringify(e.meta) : null,
      e.agenda ? JSON.stringify(e.agenda) : null,
      e.attendees ?? null,
      e.status ?? 'scheduled',
    )
    .run();
}
