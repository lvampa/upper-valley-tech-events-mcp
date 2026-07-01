// Shared plumbing for D1-backed repositories: holds the database handle and
// helpers common to every repository. Concrete repositories extend this.

export abstract class BaseRepository {
  constructor(protected readonly db: D1Database) {}

  /**
   * Parse a JSON column, tolerating null/garbage by returning undefined. Returns
   * `unknown` — the caller asserts the concrete shape, keeping the unchecked cast
   * visible at the call site rather than hidden behind a fake generic.
   */
  protected parseJson(raw: string | null): unknown {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
}
