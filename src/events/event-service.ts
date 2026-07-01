import { type EventRecord } from '@/types.ts';
import { OrganizerGatedService } from './gated-service.ts';
import { type EventStore, type OrganizerStore, type NewEvent } from './stores.ts';
import {
  type AddEventInput,
  type DataResult,
  type OpResult,
  type UpdateEventInput,
} from './results.ts';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Derive a slug like "jul-2025" from a YYYY-MM-DD date. */
export function slugFromDate(date: string): string {
  const [year, month] = date.split('-');
  return `${MONTHS[Number(month) - 1] ?? month}-${year}`;
}

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
      const id = input.id ?? slugFromDate(input.date);
      if (await this.events.exists(id)) {
        return {
          ok: false,
          error: `An event with id "${id}" already exists. Use update_event instead.`,
        };
      }
      const newEvent: NewEvent = {
        id,
        date: input.date,
        title: input.title,
        location: input.location,
        time: input.time,
        rsvpHref: input.rsvpHref,
        meta: input.meta,
        agenda: input.agenda,
        attendees: input.attendees,
      };
      await this.events.add(newEvent);
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
