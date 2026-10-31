import { BaseRepository } from './base-repository.ts';
import { type RsvpStore, type SubscriberStore } from './stores.ts';

/** D1-backed implementation of {@link SubscriberStore}. */
export class SubscriberRepository extends BaseRepository implements SubscriberStore {
  async add(email: string): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)')
      .bind(email.toLowerCase())
      .run();
  }

  async remove(email: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM subscribers WHERE email = ?')
      .bind(email.toLowerCase())
      .run();
    return result.meta.changes > 0;
  }

  async listEmails(): Promise<string[]> {
    // created_at only has second precision, so rowid breaks ties in insert order.
    const { results } = await this.db
      .prepare('SELECT email FROM subscribers ORDER BY created_at, rowid')
      .all<{ email: string }>();
    return results.map((row) => row.email);
  }
}

/** D1-backed implementation of {@link RsvpStore}. */
export class RsvpRepository extends BaseRepository implements RsvpStore {
  async add(eventId: string, email: string): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO rsvps (event_id, email) VALUES (?, ?)')
      .bind(eventId, email.toLowerCase())
      .run();
  }

  async listEmails(eventId: string): Promise<string[]> {
    const { results } = await this.db
      .prepare('SELECT email FROM rsvps WHERE event_id = ? ORDER BY created_at, rowid')
      .bind(eventId)
      .all<{ email: string }>();
    return results.map((row) => row.email);
  }
}
