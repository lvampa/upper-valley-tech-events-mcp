import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { decodeState, isClientApproved, renderApprovalDialog } from '@/auth/workers-oauth-utils.ts';

describe('CORS preflight on OAuth and MCP routes', () => {
  it('is answered by the OAuth provider, not the /events CORS policy', async () => {
    const res = await SELF.fetch('https://example.com/mcp', {
      method: 'OPTIONS',
      headers: { Origin: 'https://client.example' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://client.example');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});

describe('missing OAuth configuration', () => {
  // The test env has no Google secrets, so parseConfig throws an OAuthError.
  it('returns the OAuth JSON error on GET /authorize', async () => {
    const res = await SELF.fetch('https://example.com/authorize');
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'server_error' });
  });

  it('returns the OAuth JSON error on GET /callback', async () => {
    const res = await SELF.fetch('https://example.com/callback?state=x&code=y');
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'server_error' });
  });
});

describe('isClientApproved', () => {
  it('treats a cookie with an invalid base64 payload as not approved', async () => {
    const request = new Request('https://example.com/authorize', {
      headers: { Cookie: '__Host-APPROVED_CLIENTS=abcd.!!!not-base64' },
    });
    expect(await isClientApproved(request, 'client-1', 'secret')).toBe(false);
  });
});

describe('renderApprovalDialog', () => {
  it('encodes state with non-Latin-1 characters so the form can decode it', async () => {
    const state = { oauthReqInfo: { clientId: 'c1', state: 'café ☕' } };
    const res = renderApprovalDialog(new Request('https://example.com/authorize'), {
      client: null,
      csrfToken: 'token',
      server: { name: 'Test' },
      setCookie: 'x=y',
      state,
    });
    const html = await res.text();
    const encoded = /name="state" value="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(decodeState(encoded)).toEqual(state);
  });
});
