import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDb, seedOrganizer, seedEvent } from './helpers.ts';
import { EventRepository } from '@/events/event-repository.ts';
import { OrganizerRepository } from '@/events/organizer-repository.ts';
import { EventService } from '@/events/event-service.ts';
import { OrganizerService } from '@/events/organizer-service.ts';

const ORGANIZER = 'organizer@example.com';
const STRANGER = 'stranger@example.com';
const validEvent = {
  date: '2025-07-16',
  title: 'Lightning Talks',
  location: 'Lebanon, NH',
  time: '6:30 PM',
};

let eventRepo: EventRepository;
let organizerRepo: OrganizerRepository;
let events: EventService;
let organizerService: OrganizerService;

beforeEach(async () => {
  await resetDb(env);
  await seedOrganizer(env, ORGANIZER);
  organizerRepo = new OrganizerRepository(env.DB);
  eventRepo = new EventRepository(env.DB);
  events = new EventService(organizerRepo, eventRepo);
  organizerService = new OrganizerService(organizerRepo);
});

describe('the authorization gate', () => {
  describe('given a non-organizer', () => {
    it('rejects add_event and writes nothing', async () => {
      // when
      const r = await events.addEvent(STRANGER, { ...validEvent, id: 'x' });
      // then
      expect(r.ok).toBe(false);
      expect(await eventRepo.listAll()).toHaveLength(0);
    });
    it('rejects an unauthenticated caller (null email)', async () => {
      const r = await events.addEvent(null, { ...validEvent, id: 'x' });
      expect(r).toEqual({ ok: false, error: 'Not authenticated.' });
    });
  });

  describe('given an organizer', () => {
    it('creates an event (slug derived from date when id omitted)', async () => {
      // when
      const r = await events.addEvent(ORGANIZER, validEvent);
      // then
      expect(r.ok).toBe(true);
      const all = await eventRepo.listAll();
      expect(all.map((e) => e.id)).toEqual(['jul-2025']);
    });
    it('rejects a duplicate id', async () => {
      await events.addEvent(ORGANIZER, { ...validEvent, id: 'dup' });
      const r = await events.addEvent(ORGANIZER, { ...validEvent, id: 'dup' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('update_event');
    });
    it('updates only the provided fields', async () => {
      await seedEvent(env, { id: 'e1', date: '2025-07-16', title: 'Old' });
      const r = await events.updateEvent(ORGANIZER, { id: 'e1', title: 'New' });
      expect(r.ok).toBe(true);
      const all = await eventRepo.listAll();
      expect(all.find((e) => e.id === 'e1')?.title).toBe('New');
    });
    it('rejects an update with no fields to change', async () => {
      // given
      await seedEvent(env, { id: 'e1', date: '2025-07-16', title: 'Old' });
      // when
      const r = await events.updateEvent(ORGANIZER, { id: 'e1' });
      // then
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('fields');
    });
    it('cancels an event (and GET /events would then exclude it)', async () => {
      await seedEvent(env, { id: 'e1', date: '2025-07-16' });
      const r = await events.cancelEvent(ORGANIZER, 'e1');
      expect(r.ok).toBe(true);
      const all = await eventRepo.listAll();
      expect(all.find((e) => e.id === 'e1')?.status).toBe('cancelled');
    });
    it('reports not-found when cancelling a missing event', async () => {
      const r = await events.cancelEvent(ORGANIZER, 'does-not-exist');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('does-not-exist');
    });
    it('adds another organizer', async () => {
      const r = await organizerService.addOrganizer(ORGANIZER, 'NewPerson@Example.com');
      expect(r.ok).toBe(true);
      expect(await organizerRepo.isOrganizer('newperson@example.com')).toBe(true);
    });
  });

  describe('list_events', () => {
    it('is allowed for an organizer and denied for a stranger', async () => {
      await seedEvent(env, { id: 'e1', date: '2025-07-16' });
      expect((await events.listEvents(ORGANIZER)).ok).toBe(true);
      expect((await events.listEvents(STRANGER)).ok).toBe(false);
    });
  });
});
