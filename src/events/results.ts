// Result shapes returned by the service layer to its callers (the MCP tools).
// A uniform, discriminated result keeps the tool handlers trivial.

import { type NewEvent, type EventPatch } from './stores.ts';

/** A write op: a human-readable message on success, an error string on failure. */
export type OpResult = { ok: true; message: string } | { ok: false; error: string };

/** A read op: typed data on success, an error string on failure. */
export type DataResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Input to {@link EventService.addEvent}; id is optional (derived from date). */
export type AddEventInput = Omit<NewEvent, 'id'> & { id?: string };

/** Input to {@link EventService.updateEvent}; id selects the row to patch. */
export type UpdateEventInput = { id: string } & EventPatch;
