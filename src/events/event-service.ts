import { type EventRecord } from '@/types.ts';
import { OrganizerGatedService } from './gated-service.ts';
import { type EventStore, type OrganizerStore } from './stores.ts';
import {
  type AddEventInput,
  type DataResult,
  type OpResult,
  type UpdateEventInput,
} from './results.ts';
import { slugFromDate } from './date.ts';

/** Organizer-gated event management: list / create / patch / cancel. */
export class EventService extends OrganizerGatedService {
  constructor(
    organizers: OrganizerStore,
    private readonly events: EventStore,
  ) {
    super(organizers);
  }

  listEvents(email: string | null): Promise<DataResult<(EventRecord & { status: string })[]>> {
    return this.gate(
      email,
      async (): Promise<DataResult<(EventRecord & { status: string })[]>> => ({
        ok: true,
        data: await this.events.listAll(),
      }),
    );
  }

  addEvent(email: string | null, input: AddEventInput): Promise<OpResult> {
    return this.gate(email, async (): Promise<OpResult> => {
      const id = input.id || slugFromDate(input.date);
      // Atomic insert-or-nothing: `created` is false when the id already exists,
      // which also closes the check-then-act race two concurrent adds would hit.
      const created = await this.events.add({ ...input, id });
      if (!created) {
        return {
          ok: false,
          error: `An event with id "${id}" already exists. Use update_event instead.`,
        };
      }
      return { ok: true, message: `Created event "${id}".` };
    });
  }

  updateEvent(email: string | null, input: UpdateEventInput): Promise<OpResult> {
    return this.gate(email, async (): Promise<OpResult> => {
      const { id, ...patch } = input;
      if (Object.keys(patch).length === 0) {
        return { ok: false, error: 'No fields provided to update.' };
      }
      const updated = await this.events.update(id, patch);
      if (!updated) return { ok: false, error: `No event with id "${id}".` };
      return { ok: true, message: `Updated event "${id}".` };
    });
  }

  cancelEvent(email: string | null, id: string): Promise<OpResult> {
    return this.gate(email, async (): Promise<OpResult> => {
      const cancelled = await this.events.update(id, { status: 'cancelled' });
      if (!cancelled) return { ok: false, error: `No event with id "${id}".` };
      return { ok: true, message: `Cancelled event "${id}".` };
    });
  }
}
