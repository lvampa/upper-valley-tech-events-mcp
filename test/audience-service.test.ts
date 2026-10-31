import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDb, seedEvent, seedOrganizer } from './helpers.ts';
import { AudienceService } from '@/events/audience-service.ts';
import { EventRepository } from '@/events/event-repository.ts';
import { OrganizerRepository } from '@/events/organizer-repository.ts';
import { RsvpRepository, SubscriberRepository } from '@/events/audience-repository.ts';

const ORGANIZER = 'organizer@example.com';
const STRANGER = 'stranger@example.com';

let subscribers: SubscriberRepository;
let rsvps: RsvpRepository;
let audience: AudienceService;

beforeEach(async () => {
  await resetDb(env);
  await seedOrganizer(env, ORGANIZER);
  subscribers = new SubscriberRepository(env.DB);
  rsvps = new RsvpRepository(env.DB);
  audience = new AudienceService(
    new OrganizerRepository(env.DB),
    subscribers,
    rsvps,
    new EventRepository(env.DB),
  );
});

describe('list_subscribers', () => {
  it('returns the count and a comma-separated line for Bcc', async () => {
    await subscribers.add('ada@example.com');
    await subscribers.add('grace@example.com');
    const r = await audience.listSubscribers(ORGANIZER);
    expect(r).toEqual({ ok: true, message: '2 subscribers:\nada@example.com, grace@example.com' });
  });
  it('says so when the list is empty', async () => {
    expect(await audience.listSubscribers(ORGANIZER)).toEqual({
      ok: true,
      message: '0 subscribers.',
    });
  });
  it('is denied for a stranger', async () => {
    expect((await audience.listSubscribers(STRANGER)).ok).toBe(false);
  });
});

describe('remove_subscriber', () => {
  it('removes the email, matching case-insensitively', async () => {
    await subscribers.add('ada@example.com');
    const r = await audience.removeSubscriber(ORGANIZER, 'Ada@Example.com');
    expect(r.ok).toBe(true);
    expect(await subscribers.listEmails()).toEqual([]);
  });
  it('reports an email that is not on the list', async () => {
    const r = await audience.removeSubscriber(ORGANIZER, 'ada@example.com');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('ada@example.com');
  });
  it('is denied for a stranger and removes nothing', async () => {
    await subscribers.add('ada@example.com');
    expect((await audience.removeSubscriber(STRANGER, 'ada@example.com')).ok).toBe(false);
    expect(await subscribers.listEmails()).toEqual(['ada@example.com']);
  });
});

describe('list_rsvps', () => {
  it('returns the count and a comma-separated line', async () => {
    await seedEvent(env, { id: 'nov-2026', date: '2026-11-18' });
    await rsvps.add('nov-2026', 'ada@example.com');
    const r = await audience.listRsvps(ORGANIZER, 'nov-2026');
    expect(r).toEqual({ ok: true, message: '1 RSVP for "nov-2026":\nada@example.com' });
  });
  it('reports an unknown event', async () => {
    const r = await audience.listRsvps(ORGANIZER, 'nope');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('nope');
  });
  it('is denied for a stranger', async () => {
    await seedEvent(env, { id: 'nov-2026', date: '2026-11-18' });
    expect((await audience.listRsvps(STRANGER, 'nov-2026')).ok).toBe(false);
  });
});
