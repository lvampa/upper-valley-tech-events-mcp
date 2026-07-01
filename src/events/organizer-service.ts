import { OrganizerGatedService } from './gated-service.ts';
import { type OpResult } from './results.ts';

/** Organizer-gated management of the organizer allowlist itself. */
export class OrganizerService extends OrganizerGatedService {
  addOrganizer(email: string | null, newEmail: string): Promise<OpResult> {
    return this.gate(email, async (actor): Promise<OpResult> => {
      await this.organizers.add(newEmail, actor);
      return { ok: true, message: `Added organizer "${newEmail.toLowerCase()}".` };
    });
  }
}
