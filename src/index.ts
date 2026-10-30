import { type Env, type EventRecord } from '@/types.ts';
import { EventRepository } from '@/events/event-repository.ts';
import { EventsCache } from '@/cache.ts';
import { mcpHandler } from '@/mcp/mcp.ts';

// Edge-cache the events payload for 5 minutes. Writes (via MCP tools) purge it
// only in the data center that served the write, so other locations can serve
// the old payload until the TTL runs out. This is the primary abuse defense:
// most reads are served from cache without invoking D1.
const CACHE_TTL_SECONDS = 300;

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

async function handleGetEvents(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const cache = new EventsCache(request.url);

  const cached = await cache.match();
  if (cached) return cached;

  let events: EventRecord[];
  try {
    events = await new EventRepository(env.DB).listPublished();
  } catch (error) {
    // Without CORS headers the site's browser reports a CORS error and hides the real failure.
    console.error('GET /events failed:', error);
    return Response.json(
      { error: 'Failed to load events.' },
      { status: 500, headers: corsHeaders(env) },
    );
  }

  const response = new Response(JSON.stringify({ events }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, s-maxage=${String(CACHE_TTL_SECONDS)}`,
      ...corsHeaders(env),
    },
  });

  ctx.waitUntil(cache.put(response.clone()));
  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/events') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders(env) });
      }
      if (request.method === 'GET') {
        return handleGetEvents(request, env, ctx);
      }
    }

    // Everything else (the OAuth endpoints + the protected /mcp endpoint) is
    // handled by @cloudflare/workers-oauth-provider. It serves /authorize,
    // /token, /register, the Google /callback (via the default handler) and
    // gates /mcp behind a valid access token. It also answers CORS preflight
    // for its own routes, so preflight must not be intercepted above.
    return mcpHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
