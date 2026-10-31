import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetDb, seedEvent } from './helpers.ts';
import { createWorker } from '@/index.ts';
import { type CaptchaVerifier } from '@/captcha.ts';

const PASSING_TOKEN = 'passes';
const fakeCaptcha: CaptchaVerifier = {
  verify: (token) => Promise.resolve(token === PASSING_TOKEN),
};
const worker = createWorker(() => fakeCaptcha);

async function send(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`https://example.com${path}`, init), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

function post(path: string, body: unknown): Promise<Response> {
  return send(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function subscriberEmails(): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT email FROM subscribers').all<{
    email: string;
  }>();
  return results.map((r) => r.email);
}

async function rsvpEmails(eventId: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT email FROM rsvps WHERE event_id = ?')
    .bind(eventId)
    .all<{ email: string }>();
  return results.map((r) => r.email);
}

beforeEach(async () => {
  await resetDb(env);
});

describe('POST /subscribe', () => {
  it('given a valid signup, stores the email lower-cased', async () => {
    // when
    const res = await post('/subscribe', {
      email: '  Ada@Example.com ',
      captchaToken: PASSING_TOKEN,
    });
    // then
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await subscriberEmails()).toEqual(['ada@example.com']);
  });

  it('given a duplicate signup, replies ok and keeps one row', async () => {
    // given
    await post('/subscribe', { email: 'ada@example.com', captchaToken: PASSING_TOKEN });
    // when
    const res = await post('/subscribe', { email: 'ADA@example.com', captchaToken: PASSING_TOKEN });
    // then
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await subscriberEmails()).toEqual(['ada@example.com']);
  });

  it('given a malformed email, replies invalid_email and stores nothing', async () => {
    const res = await post('/subscribe', { email: 'not-an-email', captchaToken: PASSING_TOKEN });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'invalid_email' });
    expect(await subscriberEmails()).toEqual([]);
  });

  it('given a body that is not JSON, replies invalid_email', async () => {
    const res = await send('/subscribe', { method: 'POST', body: 'email=ada@example.com' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('given a rejected captcha, replies captcha_failed and stores nothing', async () => {
    const res = await post('/subscribe', { email: 'ada@example.com', captchaToken: 'nope' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'captcha_failed' });
    expect(await subscriberEmails()).toEqual([]);
  });

  it('given a missing captcha token, replies captcha_failed', async () => {
    const res = await post('/subscribe', { email: 'ada@example.com' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'captcha_failed' });
  });

  it('checks the email before the captcha', async () => {
    const res = await post('/subscribe', { email: 'nope', captchaToken: 'nope' });
    expect(await res.json()).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('given a database failure, replies server with CORS headers', async () => {
    // given
    await env.DB.exec('DROP TABLE subscribers');
    // when
    const res = await post('/subscribe', { email: 'ada@example.com', captchaToken: PASSING_TOKEN });
    // then
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'server' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
  });

  it('given a captcha service failure, replies server', async () => {
    const failing = createWorker(() => ({ verify: () => Promise.reject(new Error('down')) }));
    const ctx = createExecutionContext();
    const res = await failing.fetch(
      new Request('https://example.com/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'ada@example.com', captchaToken: PASSING_TOKEN }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'server' });
  });

  it('puts CORS headers and no-store on error replies', async () => {
    const res = await post('/subscribe', { email: 'nope' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers CORS preflight with POST allowed', async () => {
    const res = await send('/subscribe', { method: 'OPTIONS' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });
});

describe('POST /events/:id/rsvp', () => {
  const upcoming = '2999-01-01';

  it('given an upcoming event, stores the RSVP lower-cased', async () => {
    // given
    await seedEvent(env, { id: 'jan-2999', date: upcoming });
    // when
    const res = await post('/events/jan-2999/rsvp', {
      email: 'Ada@Example.com',
      captchaToken: PASSING_TOKEN,
    });
    // then
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await rsvpEmails('jan-2999')).toEqual(['ada@example.com']);
  });

  it('given a duplicate RSVP, replies ok and keeps one row', async () => {
    await seedEvent(env, { id: 'jan-2999', date: upcoming });
    await post('/events/jan-2999/rsvp', { email: 'ada@example.com', captchaToken: PASSING_TOKEN });
    const res = await post('/events/jan-2999/rsvp', {
      email: 'ada@example.com',
      captchaToken: PASSING_TOKEN,
    });
    expect(res.status).toBe(200);
    expect(await rsvpEmails('jan-2999')).toEqual(['ada@example.com']);
  });

  it.each([
    ['an unknown event', null],
    ['a cancelled event', { id: 'x', date: upcoming, status: 'cancelled' }],
    ['a past event', { id: 'x', date: '2000-01-01' }],
  ])('given %s, replies not_found with CORS headers', async (_, event) => {
    // given
    if (event) await seedEvent(env, event);
    // when
    const res = await post('/events/x/rsvp', {
      email: 'ada@example.com',
      captchaToken: PASSING_TOKEN,
    });
    // then
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'not_found' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
    expect(await rsvpEmails('x')).toEqual([]);
  });

  it('given a rejected captcha, replies captcha_failed and stores nothing', async () => {
    await seedEvent(env, { id: 'jan-2999', date: upcoming });
    const res = await post('/events/jan-2999/rsvp', {
      email: 'ada@example.com',
      captchaToken: 'nope',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'captcha_failed' });
    expect(await rsvpEmails('jan-2999')).toEqual([]);
  });

  it('answers CORS preflight', async () => {
    const res = await send('/events/jan-2999/rsvp', { method: 'OPTIONS' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});
