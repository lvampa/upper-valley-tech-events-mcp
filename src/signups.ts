// Public signup endpoints: POST /subscribe and POST /events/:id/rsvp.
// The reply contract is shared with the site (upper-valley-tech-web docs/subscribe.md).

import { z } from 'zod';
import { type Env } from '@/types.ts';
import { type CaptchaVerifier } from '@/captcha.ts';
import { corsHeaders } from '@/cors.ts';
import { EventRepository } from '@/events/event-repository.ts';
import { RsvpRepository, SubscriberRepository } from '@/events/audience-repository.ts';
import { todayInMeetupTimezone } from '@/events/date.ts';

type SignupError = 'invalid_email' | 'captcha_failed' | 'not_found' | 'server';
type SignupReply = { ok: true } | { ok: false; error: SignupError };
type SignupHandler = (request: Request, env: Env, captcha: CaptchaVerifier) => Promise<Response>;

const RSVP_PATH = /^\/events\/([^/]+)\/rsvp$/;

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  captchaToken: z.string().min(1).optional(),
});

/** The signup handler for a path, or null if the path isn't a signup endpoint. */
export function matchSignupRoute(pathname: string): SignupHandler | null {
  if (pathname === '/subscribe') return handleSubscribe;
  const rsvp = RSVP_PATH.exec(pathname);
  if (rsvp) return (request, env, captcha) => handleRsvp(request, env, captcha, rsvp[1]);
  return null;
}

function handleSubscribe(request: Request, env: Env, captcha: CaptchaVerifier): Promise<Response> {
  return withServerError('POST /subscribe', env, async () => {
    const signup = await verifiedSignup(request, captcha);
    if ('error' in signup) return reply(env, 400, { ok: false, error: signup.error });

    await new SubscriberRepository(env.DB).add(signup.email);
    return reply(env, 200, { ok: true });
  });
}

function handleRsvp(
  request: Request,
  env: Env,
  captcha: CaptchaVerifier,
  rawEventId: string,
): Promise<Response> {
  return withServerError('POST /events/:id/rsvp', env, async () => {
    const signup = await verifiedSignup(request, captcha);
    if ('error' in signup) return reply(env, 400, { ok: false, error: signup.error });

    const eventId = decodePathSegment(rawEventId);
    if (!eventId || !(await isOpenForRsvp(env, eventId))) {
      return reply(env, 404, { ok: false, error: 'not_found' });
    }

    await new RsvpRepository(env.DB).add(eventId, signup.email);
    return reply(env, 200, { ok: true });
  });
}

/** The lower-cased email once the body is valid and the captcha passes, else the reply code. */
async function verifiedSignup(
  request: Request,
  captcha: CaptchaVerifier,
): Promise<{ email: string } | { error: 'invalid_email' | 'captcha_failed' }> {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return { error: 'invalid_email' };

  const { email, captchaToken } = parsed.data;
  if (!captchaToken || !(await captcha.verify(captchaToken))) return { error: 'captcha_failed' };
  return { email };
}

/** Scheduled and not before today. An event stays open all of its own day. */
async function isOpenForRsvp(env: Env, eventId: string): Promise<boolean> {
  const event = await new EventRepository(env.DB).findById(eventId);
  return event?.status === 'scheduled' && event.date >= todayInMeetupTimezone();
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

async function withServerError(
  route: string,
  env: Env,
  handle: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handle();
  } catch (error) {
    console.error(`${route} failed:`, error);
    return reply(env, 500, { ok: false, error: 'server' });
  }
}

function reply(env: Env, status: number, body: SignupReply): Response {
  return Response.json(body, {
    status,
    // Each reply is about one person's signup, so no cache may store or replay it.
    headers: { 'Cache-Control': 'no-store', ...corsHeaders(env) },
  });
}
