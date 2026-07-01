import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { resetDb, seedEvent } from './helpers.ts';
import { EventsCache } from '@/cache.ts';

beforeEach(async () => {
  await resetDb(env);
  // GET /events is edge-cached on the "/events" URL; the cache persists across
  // tests in the same worker instance, so purge it to keep each test isolated.
  await new EventsCache('https://example.com/events').purge();
});

describe('GET /events', () => {
  it('given scheduled and cancelled events, returns only scheduled ones', async () => {
    // given
    await seedEvent(env, { id: 'live', date: '2025-07-16' });
    await seedEvent(env, { id: 'dead', date: '2025-08-16', status: 'cancelled' });
    // when
    const res = await SELF.fetch('https://example.com/events');
    const body = await res.json<{ events: { id: string }[] }>();
    // then
    expect(res.status).toBe(200);
    expect(body.events.map((e: { id: string }) => e.id)).toEqual(['live']);
  });

  it('sets a cache-control header', async () => {
    const res = await SELF.fetch('https://example.com/events');
    expect(res.headers.get('Cache-Control')).toMatch(/s-maxage/);
  });

  it('parses meta and agenda JSON columns into arrays', async () => {
    // given
    await seedEvent(env, {
      id: 'jul',
      date: '2025-07-16',
      meta: ['Doors 6:30'],
      agenda: [{ time: '7:05', description: '— a talk' }],
    });
    // when
    const res = await SELF.fetch('https://example.com/events');
    const body = await res.json<{ events: { meta: string[]; agenda: { time: string }[] }[] }>();
    // then
    expect(body.events[0].meta).toEqual(['Doors 6:30']);
    expect(body.events[0].agenda[0].time).toBe('7:05');
  });
});
