// The public /events response is edge-cached. This class encapsulates the
// cache key so the read path (index.ts) and the write path (MCP tools) agree
// on it — construct one from the request URL and call match/put/purge.

export class EventsCache {
  constructor(private readonly requestUrl: string) {}

  /** The Request used as the edge-cache key for GET /events. */
  private key(): Request {
    return new Request(new URL('/events', this.requestUrl).toString());
  }

  /** The cached response, or undefined on a miss. */
  match(): Promise<Response | undefined> {
    return caches.default.match(this.key());
  }

  /** Store a response under the cache key. */
  async put(response: Response): Promise<void> {
    await caches.default.put(this.key(), response);
  }

  /** Drop the cached response after a write so the site refreshes promptly. */
  async purge(): Promise<void> {
    await caches.default.delete(this.key());
  }
}
