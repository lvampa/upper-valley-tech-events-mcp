// Persistence contracts for the events domain. Services depend on these
// interfaces, not on the concrete D1 repositories, so they can be unit-tested
// against fakes and the storage layer can change without touching business logic.

import { type AgendaItem, type EventRecord, type OrganizerRecord } from '@/types.ts';

/** Fields accepted when creating an event. meta/agenda are stored as JSON strings. */
export interface NewEvent {
  id: string;
  date: string;
  title: string;
  location: string;
  time: string;
  rsvpHref?: string;
  meta?: string[];
  agenda?: AgendaItem[];
}

/** Fields an update may patch. `id` selects the row and is not part of the patch. */
export interface EventPatch {
  date?: string;
  title?: string;
  location?: string;
  time?: string;
  rsvpHref?: string | null;
  meta?: string[] | null;
  agenda?: AgendaItem[] | null;
  status?: 'scheduled' | 'cancelled';
}

/** Storage contract for events. */
export interface EventStore {
  /** All non-cancelled events, oldest first (the public read path). */
  listPublished(): Promise<EventRecord[]>;
  /** Every event including cancelled ones, newest first (organizer view). */
  listAll(): Promise<(EventRecord & { status: string })[]>;
  /** One event including its status, or null if no such id. */
  findById(id: string): Promise<(EventRecord & { status: string }) | null>;
  /** Insert a new (scheduled) event. Returns false if the id already exists. */
  add(event: NewEvent): Promise<boolean>;
  /** Patch the provided fields of an event. Returns false if no such event. */
  update(id: string, patch: EventPatch): Promise<boolean>;
}

/** Storage contract for the organizer allowlist. */
export interface OrganizerStore {
  /** True if the (case-insensitive) email is an organizer. */
  isOrganizer(email: string): Promise<boolean>;
  /** Every organizer, oldest first. */
  listAll(): Promise<OrganizerRecord[]>;
  /** Add an organizer to the allowlist (idempotent). */
  add(email: string, addedBy: string): Promise<void>;
  /** Remove an organizer unless they are the last one. Returns false if nothing was removed. */
  removeUnlessLast(email: string): Promise<boolean>;
}

/** Storage contract for the mailing list. Emails are stored lower-cased. */
export interface SubscriberStore {
  /** Add an email to the list (idempotent). */
  add(email: string): Promise<void>;
  /** Remove an email. Returns false if it wasn't on the list. */
  remove(email: string): Promise<boolean>;
  /** Every email on the list, oldest signup first. */
  listEmails(): Promise<string[]>;
}

/** Storage contract for event RSVPs. Emails are stored lower-cased. */
export interface RsvpStore {
  /** Record an RSVP (idempotent). */
  add(eventId: string, email: string): Promise<void>;
  /** Every email that RSVP'd to the event, oldest first. */
  listEmails(eventId: string): Promise<string[]>;
}
