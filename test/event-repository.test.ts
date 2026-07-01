import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDb, seedEvent } from './helpers.ts';
import { EventRepository } from '@/events/event-repository.ts';

let repo: EventRepository;

beforeEach(async () => {
  await resetDb(env);
  repo = new EventRepository(env.DB);
});

describe('row mapping', () => {
  it('given a row with null meta/agenda, omits them on the record', async () => {
    await seedEvent(env, { id: 'plain', date: '2025-07-16' });
    const [rec] = await repo.listPublished();
    expect(rec.meta).toBeUndefined();
    expect(rec.agenda).toBeUndefined();
    expect(rec.rsvpHref).toBeUndefined();
  });
  it('given JSON columns, parses them into arrays', async () => {
    await seedEvent(env, {
      id: 'rich',
      date: '2025-07-16',
      meta: ['a', 'b'],
      agenda: [{ time: '7:05', description: 'x' }],
    });
    const [rec] = await repo.listPublished();
    expect(rec.meta).toEqual(['a', 'b']);
    expect(rec.agenda).toEqual([{ time: '7:05', description: 'x' }]);
  });
});

describe('update patch building', () => {
  it('given an unknown id, returns false', async () => {
    expect(await repo.update('nope', { title: 'x' })).toBe(false);
  });
  it('leaves unspecified fields untouched', async () => {
    await seedEvent(env, { id: 'e1', date: '2025-07-16', title: 'Keep', location: 'Hanover, NH' });
    await repo.update('e1', { title: 'Changed' });
    const [rec] = await repo.listPublished();
    expect(rec.title).toBe('Changed');
    expect(rec.location).toBe('Hanover, NH');
  });
});
