// OAuth-protected MCP server for the UVT events service.
//
// We use createMcpHandler (stateless, no Durable Object) wrapped by
// @cloudflare/workers-oauth-provider. The OAuthProvider delegates human login
// to Google (see auth/oauth-handler.ts), mints an MCP access token carrying the
// user's email in props, and gates /mcp behind that token. Each tool reads the
// caller's email from getMcpAuthContext() and delegates to a service; the
// services enforce the organizer gate. After a successful write we purge the
// cached /events response so the public site refreshes promptly.

import OAuthProvider from '@cloudflare/workers-oauth-provider';
import { createMcpHandler, getMcpAuthContext } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { type Env } from '@/types.ts';
import { type Props, GoogleHandler } from '@/auth/oauth-handler.ts';
import { EventsCache } from '@/cache.ts';
import { EventRepository } from '@/events/event-repository.ts';
import { OrganizerRepository } from '@/events/organizer-repository.ts';
import { EventService } from '@/events/event-service.ts';
import { OrganizerService } from '@/events/organizer-service.ts';
import { isCalendarDate } from '@/events/date.ts';
import { type DataResult, type OpResult } from '@/events/results.ts';

const agendaItemSchema = z.object({
  time: z.string(),
  speaker: z.string().optional(),
  description: z.string(),
  open: z.boolean().optional(),
});

// A YYYY-MM-DD string that is also a real calendar date. isCalendarDate rejects
// impossible days like 2025-02-30, which Date.parse would silently roll over.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine(isCalendarDate, 'date is not a real calendar date');

// MCP tool result helpers.
function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function fail(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

/**
 * Map a service result to an MCP response: JSON data or a message on success,
 * the error text on failure. Pass `cache` for write tools to purge /events first.
 */
async function respond(r: OpResult | DataResult<unknown>, cache?: EventsCache) {
  if (!r.ok) return fail(r.error);
  if (cache) await cache.purge();
  return 'data' in r ? ok(JSON.stringify(r.data, null, 2)) : ok(r.message);
}

/** The caller's verified email from the OAuth props, or null if absent. */
function callerEmail(): string | null {
  const auth = getMcpAuthContext();
  const props = auth?.props as Props | undefined;
  return typeof props?.email === 'string' ? props.email : null;
}

/** Build the MCP server for a single request, closing over env + request URL. */
function createServer(env: Env, requestUrl: string): McpServer {
  const server = new McpServer({ name: 'UVT Events', version: '1.0.0' });

  const organizers = new OrganizerRepository(env.DB);
  const events = new EventService(organizers, new EventRepository(env.DB));
  const organizerService = new OrganizerService(organizers);
  const cache = new EventsCache(requestUrl);

  server.registerTool(
    'list_events',
    { description: 'List all events including cancelled ones, for an organizer to inspect.' },
    async () => respond(await events.listEvents(callerEmail())),
  );

  server.registerTool(
    'add_event',
    {
      description: 'Create a new event. If id is omitted it is derived from the date (YYYY-MM-DD).',
      inputSchema: {
        id: z
          .string()
          .min(1)
          .optional()
          .describe('URL slug, e.g. "jul-2025". Derived from date if omitted.'),
        date: isoDate,
        title: z.string(),
        location: z.string(),
        time: z.string().describe('Display time, e.g. "6:30 PM".'),
        rsvpHref: z.url().optional(),
        meta: z.array(z.string()).optional(),
        agenda: z.array(agendaItemSchema).optional(),
        attendees: z.string().optional(),
      },
    },
    async (input) => respond(await events.addEvent(callerEmail(), input), cache),
  );

  server.registerTool(
    'update_event',
    {
      description: 'Patch fields of an existing event by id. Only provided fields change.',
      inputSchema: {
        id: z.string(),
        date: isoDate.optional(),
        title: z.string().optional(),
        location: z.string().optional(),
        time: z.string().optional(),
        rsvpHref: z.url().nullable().optional(),
        meta: z.array(z.string()).nullable().optional(),
        agenda: z.array(agendaItemSchema).nullable().optional(),
        attendees: z.string().nullable().optional(),
        status: z.enum(['scheduled', 'cancelled']).optional(),
      },
    },
    async (input) => respond(await events.updateEvent(callerEmail(), input), cache),
  );

  server.registerTool(
    'cancel_event',
    {
      description: 'Mark an event as cancelled by id.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => respond(await events.cancelEvent(callerEmail(), id), cache),
  );

  server.registerTool(
    'add_organizer',
    {
      description: 'Add an email to the organizers allowlist (organizer-only).',
      inputSchema: { email: z.email() },
    },
    async ({ email }) => respond(await organizerService.addOrganizer(callerEmail(), email)),
  );

  return server;
}

// Wrap createMcpHandler in an ExportedHandler (object with .fetch), which is
// what OAuthProvider.apiHandler expects. A fresh server is built per request.
const apiHandler = {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const server = createServer(env, request.url);
    return createMcpHandler(server)(request, env, ctx);
  },
};

// The OAuthProvider IS the entrypoint for everything except GET /events: it
// serves /authorize, /token, /register and the Google /callback (via the
// default handler) and protects /mcp behind a valid access token.
export const mcpHandler = new OAuthProvider({
  apiHandler,
  apiRoute: '/mcp',
  authorizeEndpoint: '/authorize',
  clientRegistrationEndpoint: '/register',
  defaultHandler: GoogleHandler,
  tokenEndpoint: '/token',
});
