import { type EventRecord, type EventRow, type AgendaItem } from '@/types.ts';
import { BaseRepository } from './base-repository.ts';
import { type EventStore, type NewEvent, type EventPatch } from './stores.ts';

/** D1-backed implementation of {@link EventStore}. */
export class EventRepository extends BaseRepository implements EventStore {
  private rowToEvent(row: EventRow): EventRecord {
    return {
      id: row.id,
      date: row.date,
      title: row.title,
      location: row.location,
      time: row.time,
      rsvpHref: row.rsvp_href ?? undefined,
      meta: this.parseJson(row.meta) as string[] | undefined,
      agenda: this.parseJson(row.agenda) as AgendaItem[] | undefined,
      attendees: row.attendees ?? undefined,
    };
  }

  async listPublished(): Promise<EventRecord[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM events WHERE status = 'scheduled' ORDER BY date ASC")
      .all<EventRow>();
    return results.map((row) => this.rowToEvent(row));
  }

  async listAll(): Promise<(EventRecord & { status: string })[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM events ORDER BY date DESC')
      .all<EventRow>();
    return results.map((row) => ({ ...this.rowToEvent(row), status: row.status }));
  }

  async add(e: NewEvent): Promise<boolean> {
    const result = await this.db
      .prepare(
        `INSERT INTO events (id, date, title, location, time, rsvp_href, meta, agenda, attendees, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
         ON CONFLICT(id) DO NOTHING`,
      )
      .bind(
        e.id,
        e.date,
        e.title,
        e.location,
        e.time,
        e.rsvpHref ?? null,
        e.meta ? JSON.stringify(e.meta) : null,
        e.agenda ? JSON.stringify(e.agenda) : null,
        e.attendees ?? null,
      )
      .run();
    return result.meta.changes > 0;
  }

  async update(id: string, patch: EventPatch): Promise<boolean> {
    const sets: string[] = [];
    const binds: (string | null)[] = [];

    const push = (column: string, value: string | null) => {
      sets.push(`${column} = ?`);
      binds.push(value);
    };

    if (patch.date !== undefined) push('date', patch.date);
    if (patch.title !== undefined) push('title', patch.title);
    if (patch.location !== undefined) push('location', patch.location);
    if (patch.time !== undefined) push('time', patch.time);
    if (patch.rsvpHref !== undefined) push('rsvp_href', patch.rsvpHref);
    if (patch.meta !== undefined)
      push('meta', patch.meta === null ? null : JSON.stringify(patch.meta));
    if (patch.agenda !== undefined)
      push('agenda', patch.agenda === null ? null : JSON.stringify(patch.agenda));
    if (patch.attendees !== undefined) push('attendees', patch.attendees);
    if (patch.status !== undefined) push('status', patch.status);

    // Empty-patch policy lives in EventService.updateEvent; the repo never
    // emits `UPDATE ... SET  WHERE` and reports "nothing updated".
    if (sets.length === 0) return false;

    sets.push("updated_at = datetime('now')");

    const result = await this.db
      .prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...binds, id)
      .run();
    return result.meta.changes > 0;
  }
}
