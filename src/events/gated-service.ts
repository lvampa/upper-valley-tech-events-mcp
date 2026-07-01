import { type OrganizerStore } from './stores.ts';

/** The success branch of a gated op; `gate` adds the shared failure branch. */
type Gated<R> = R | { ok: false; error: string };

/**
 * Base class for services whose every operation requires an authenticated
 * organizer. The authorization gate lives here exactly once: a subclass runs
 * its logic by passing a callback to {@link gate}, so an operation physically
 * cannot execute its body without first clearing the organizer check. This is
 * the security boundary made structural rather than a convention to remember.
 */
export abstract class OrganizerGatedService {
  constructor(protected readonly organizers: OrganizerStore) {}

  /** Run `fn` only for a verified organizer; otherwise short-circuit with an error. */
  protected async gate<R>(
    email: string | null,
    fn: (email: string) => Promise<R>,
  ): Promise<Gated<R>> {
    if (!email) return { ok: false, error: 'Not authenticated.' };
    if (!(await this.organizers.isOrganizer(email))) {
      return { ok: false, error: `Access denied: ${email} is not an organizer.` };
    }
    return fn(email);
  }
}
