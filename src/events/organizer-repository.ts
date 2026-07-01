import { BaseRepository } from './base-repository.ts';
import { type OrganizerStore } from './stores.ts';

/** D1-backed implementation of {@link OrganizerStore}. Emails are stored lower-cased. */
export class OrganizerRepository extends BaseRepository implements OrganizerStore {
  async isOrganizer(email: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 FROM organizers WHERE email = ?')
      .bind(email.toLowerCase())
      .first();
    return row !== null;
  }

  async add(email: string, addedBy: string): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO organizers (email, added_by) VALUES (?, ?)')
      .bind(email.toLowerCase(), addedBy.toLowerCase())
      .run();
  }
}
