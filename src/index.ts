import { type Env, type EventRecord } from '@/types.ts';
import { EventRepository } from '@/events/event-repository.ts';
import { EventsCache } from '@/cache.ts';
import { mcpHandler } from '@/mcp/mcp.ts';
import { corsHeaders } from '@/cors.ts';
import { type CaptchaVerifier, HCaptchaVerifier } from '@/captcha.ts';
import { matchSignupRoute } from '@/signups.ts';

// Edge-cache the events payload for 5 minutes. Writes (via MCP tools) purge it
// only in the data center that served the write, so other locations can serve
// the old payload until the TTL runs out. This is the primary abuse defense:
// most reads are served from cache without invoking D1.
const CACHE_TTL_SECONDS = 300;

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

/** Builds the Worker. Tests pass a fake captcha; production uses hCaptcha. */
export function createWorker(makeCaptcha: (env: Env) => CaptchaVerifier) {
  return {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
      return route(request, env, ctx, makeCaptcha);
    },
  } satisfies ExportedHandler<Env>;
}

export default createWorker((env) => new HCaptchaVerifier(env.HCAPTCHA_SECRET));

function route(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  makeCaptcha: (env: Env) => CaptchaVerifier,
): Response | Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/events') {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }
    if (request.method === 'GET') {
      return handleGetEvents(request, env, ctx);
    }
  }

  const signup = matchSignupRoute(url.pathname);
  if (signup) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }
    if (request.method === 'POST') {
      return signup(request, env, makeCaptcha(env));
    }
  }

  // Everything else (the OAuth endpoints + the protected /mcp endpoint) is
  // handled by @cloudflare/workers-oauth-provider. It serves /authorize,
  // /token, /register, the Google /callback (via the default handler) and
  // gates /mcp behind a valid access token. It also answers CORS preflight
  // for its own routes, so preflight must not be intercepted above.
  return mcpHandler.fetch(request, env, ctx);
}
