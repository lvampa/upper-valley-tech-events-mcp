import { type OrganizerRecord } from '@/types.ts';
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

  async listAll(): Promise<OrganizerRecord[]> {
    // created_at only has second precision, so rowid breaks ties in insert order.
    const { results } = await this.db
      .prepare(
        'SELECT email, added_by AS addedBy, created_at AS addedAt FROM organizers ORDER BY created_at, rowid',
      )
      .all<OrganizerRecord>();
    return results;
  }

  async add(email: string, addedBy: string): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO organizers (email, added_by) VALUES (?, ?)')
      .bind(email.toLowerCase(), addedBy.toLowerCase())
      .run();
  }

  async removeUnlessLast(email: string): Promise<boolean> {
    // The count check lives in the DELETE itself so two concurrent removals
    // can't both pass a separate check and leave nobody able to log in.
    const result = await this.db
      .prepare(
        `DELETE FROM organizers
         WHERE email = ? AND (SELECT COUNT(*) FROM organizers) > 1`,
      )
      .bind(email.toLowerCase())
      .run();
    return result.meta.changes > 0;
  }
}
