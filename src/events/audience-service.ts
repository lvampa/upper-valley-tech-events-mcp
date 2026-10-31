import { OrganizerGatedService } from './gated-service.ts';
import { type OpResult } from './results.ts';
import {
  type EventStore,
  type OrganizerStore,
  type RsvpStore,
  type SubscriberStore,
} from './stores.ts';

/** Organizer-gated access to the people who signed up: mailing-list subscribers and RSVPs. */
export class AudienceService extends OrganizerGatedService {
  constructor(
    organizers: OrganizerStore,
    private readonly subscribers: SubscriberStore,
    private readonly rsvps: RsvpStore,
    private readonly events: EventStore,
  ) {
    super(organizers);
  }

  listSubscribers(email: string | null): Promise<OpResult> {
    return this.gate(email, async (): Promise<OpResult> => {
      const emails = await this.subscribers.listEmails();
      return { ok: true, message: emailListMessage(emails, 'subscriber') };
    });
  }

  removeSubscriber(email: string | null, target: string): Promise<OpResult> {
    return this.gate(email, async (): Promise<OpResult> => {
      const normalized = target.toLowerCase();
      if (!(await this.subscribers.remove(normalized))) {
        return { ok: false, error: `"${normalized}" is not on the mailing list.` };
      }
      return { ok: true, message: `Removed "${normalized}" from the mailing list.` };
    });
  }

  listRsvps(email: string | null, eventId: string): Promise<OpResult> {
    return this.gate(email, async (): Promise<OpResult> => {
      if (!(await this.events.findById(eventId))) {
        return { ok: false, error: `No event with id "${eventId}".` };
      }
      const emails = await this.rsvps.listEmails(eventId);
      return { ok: true, message: emailListMessage(emails, `RSVP`, ` for "${eventId}"`) };
    });
  }
}

/** "2 subscribers:\na@x, b@y", one line so it pastes straight into Gmail's Bcc field. */
function emailListMessage(emails: string[], noun: string, suffix = ''): string {
  const counted = `${String(emails.length)} ${noun}${emails.length === 1 ? '' : 's'}${suffix}`;
  if (emails.length === 0) return `${counted}.`;
  return `${counted}:\n${emails.join(', ')}`;
}
