// Persistence contracts for the events domain. Services depend on these
// interfaces, not on the concrete D1 repositories, so they can be unit-tested
// against fakes and the storage layer can change without touching business logic.

import { type AgendaItem, type EventRecord } from '@/types.ts';

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
  attendees?: string;
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
  attendees?: string | null;
  status?: 'scheduled' | 'cancelled';
}

/** Storage contract for events. */
export interface EventStore {
  /** All non-cancelled events, oldest first (the public read path). */
  listPublished(): Promise<EventRecord[]>;
  /** Every event including cancelled ones, newest first (organizer view). */
  listAll(): Promise<(EventRecord & { status: string })[]>;
  /** Insert a new (scheduled) event. Returns false if the id already exists. */
  add(event: NewEvent): Promise<boolean>;
  /** Patch the provided fields of an event. Returns false if no such event. */
  update(id: string, patch: EventPatch): Promise<boolean>;
}

/** Storage contract for the organizer allowlist. */
export interface OrganizerStore {
  /** True if the (case-insensitive) email is an organizer. */
  isOrganizer(email: string): Promise<boolean>;
  /** Add an organizer to the allowlist (idempotent). */
  add(email: string, addedBy: string): Promise<void>;
}
