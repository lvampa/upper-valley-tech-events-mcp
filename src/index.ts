import { type Env } from '@/types.ts';
import { EventRepository } from '@/events/event-repository.ts';
import { EventsCache } from '@/cache.ts';
import { mcpHandler } from '@/mcp/mcp.ts';

// Edge-cache the events payload for 5 minutes. Writes (via MCP tools) purge it,
// so new events still surface within the TTL at worst. This is the primary
// abuse defense: most reads are served from cache without invoking D1.
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

  const events = await new EventRepository(env.DB).listPublished();
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

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (request.method === 'GET' && url.pathname === '/events') {
      return handleGetEvents(request, env, ctx);
    }

    // Everything else (the OAuth endpoints + the protected /mcp endpoint) is
    // handled by @cloudflare/workers-oauth-provider. It serves /authorize,
    // /token, /register, the Google /callback (via the default handler) and
    // gates /mcp behind a valid access token.
    return mcpHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
