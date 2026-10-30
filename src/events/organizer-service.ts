import { OrganizerGatedService } from './gated-service.ts';
import { type OrganizerRecord } from '@/types.ts';
import { type DataResult, type OpResult } from './results.ts';

/** Organizer-gated management of the organizer allowlist itself. */
export class OrganizerService extends OrganizerGatedService {
  listOrganizers(email: string | null): Promise<DataResult<OrganizerRecord[]>> {
    return this.gate(email, async (): Promise<DataResult<OrganizerRecord[]>> => ({
      ok: true,
      data: await this.organizers.listAll(),
    }));
  }

  addOrganizer(email: string | null, newEmail: string): Promise<OpResult> {
    return this.gate(email, async (actor): Promise<OpResult> => {
      await this.organizers.add(newEmail, actor);
      return { ok: true, message: `Added organizer "${newEmail.toLowerCase()}".` };
    });
  }

  removeOrganizer(email: string | null, target: string): Promise<OpResult> {
    return this.gate(email, async (): Promise<OpResult> => {
      const normalized = target.toLowerCase();
      if (await this.organizers.removeUnlessLast(normalized)) {
        return { ok: true, message: `Removed organizer "${normalized}".` };
      }
      if (!(await this.organizers.isOrganizer(normalized))) {
        return { ok: false, error: `"${normalized}" is not an organizer.` };
      }
      return { ok: false, error: `Can't remove "${normalized}": they are the last organizer.` };
    });
  }
}
