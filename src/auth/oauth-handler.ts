// Google OAuth "default handler" for @cloudflare/workers-oauth-provider.
//
// Flow: the OAuthProvider routes /authorize and the Google /callback to this
// Hono app. We show a consent screen (CSRF-protected), redirect the browser to
// Google, exchange the returned code for tokens, read the user's verified email
// from Google's userinfo endpoint, and call completeAuthorization() to mint the
// MCP access token with { email } stored in props. The MCP tools read that
// email via getMcpAuthContext() and gate writes on isOrganizer().

import { type AuthRequest, type OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { Hono } from 'hono';
import { type Env } from '@/types.ts';
import { OrganizerRepository } from '@/events/organizer-repository.ts';
import { parseConfig } from './env.ts';
import {
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  generateCSRFProtection,
  isClientApproved,
  OAuthError,
  renderApprovalDialog,
  validateCSRFToken,
  validateOAuthState,
} from './workers-oauth-utils.ts';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_SCOPE = 'openid email profile';

// Props carried in the MCP access token and exposed to tools via getMcpAuthContext().
export interface Props extends Record<string, unknown> {
  email: string;
  name?: string;
}

type Bindings = Env & { OAUTH_PROVIDER: OAuthHelpers };

const app = new Hono<{ Bindings: Bindings }>();

function redirectToGoogle(
  request: Request,
  clientId: string,
  stateToken: string,
  headers: Record<string, string> = {},
): Response {
  const upstream = new URL(GOOGLE_AUTHORIZE_URL);
  upstream.searchParams.set('client_id', clientId);
  upstream.searchParams.set('redirect_uri', new URL('/callback', request.url).href);
  upstream.searchParams.set('scope', GOOGLE_SCOPE);
  upstream.searchParams.set('response_type', 'code');
  upstream.searchParams.set('state', stateToken);
  // Ask Google to always return a fresh, verified email selection.
  upstream.searchParams.set('prompt', 'select_account');
  return new Response(null, {
    status: 302,
    headers: { ...headers, location: upstream.href },
  });
}

app.get('/authorize', async (c) => {
  const { GOOGLE_CLIENT_ID: googleClientId, COOKIE_ENCRYPTION_KEY: cookieKey } = parseConfig(c.env);

  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) {
    return c.text('Invalid request', 400);
  }

  // Returning MCP client already consented: skip the dialog.
  if (await isClientApproved(c.req.raw, clientId, cookieKey)) {
    const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie } = await bindStateToSession(stateToken);
    return redirectToGoogle(c.req.raw, googleClientId, stateToken, { 'Set-Cookie': setCookie });
  }

  const { token: csrfToken, setCookie } = generateCSRFProtection();
  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    csrfToken,
    server: {
      description: 'Upper Valley Tech events service. Sign in with Google to manage events.',
      name: 'UVT Events MCP Server',
    },
    setCookie,
    state: { oauthReqInfo },
  });
});

app.post('/authorize', async (c) => {
  try {
    const { GOOGLE_CLIENT_ID: googleClientId, COOKIE_ENCRYPTION_KEY: cookieKey } = parseConfig(
      c.env,
    );
    const formData = await c.req.raw.formData();

    validateCSRFToken(formData, c.req.raw);

    const encodedState = formData.get('state');
    if (!encodedState || typeof encodedState !== 'string') {
      return c.text('Missing state in form data', 400);
    }

    let state: { oauthReqInfo?: AuthRequest };
    try {
      state = JSON.parse(atob(encodedState)) as { oauthReqInfo?: AuthRequest };
    } catch {
      return c.text('Invalid state data', 400);
    }

    if (!state.oauthReqInfo?.clientId) {
      return c.text('Invalid request', 400);
    }

    const approvedClientCookie = await addApprovedClient(
      c.req.raw,
      state.oauthReqInfo.clientId,
      cookieKey,
    );
    const { stateToken } = await createOAuthState(state.oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);

    const headers = new Headers();
    headers.append('Set-Cookie', approvedClientCookie);
    headers.append('Set-Cookie', sessionBindingCookie);

    return redirectToGoogle(c.req.raw, googleClientId, stateToken, Object.fromEntries(headers));
  } catch (error) {
    if (error instanceof OAuthError) {
      return error.toResponse();
    }
    const message = error instanceof Error ? error.message : 'unknown error';
    return c.text(`Internal server error: ${message}`, 500);
  }
});

app.get('/callback', async (c) => {
  const { GOOGLE_CLIENT_ID: googleClientId, GOOGLE_CLIENT_SECRET: googleClientSecret } =
    parseConfig(c.env);

  let oauthReqInfo: AuthRequest;
  let clearSessionCookie: string;
  try {
    const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
    oauthReqInfo = result.oauthReqInfo;
    clearSessionCookie = result.clearCookie;
  } catch (error) {
    if (error instanceof OAuthError) {
      return error.toResponse();
    }
    return c.text('Internal server error', 500);
  }

  if (!oauthReqInfo.clientId) {
    return c.text('Invalid OAuth request data', 400);
  }

  const code = c.req.query('code');
  if (!code) {
    return c.text('Missing authorization code', 400);
  }

  // Exchange the code for tokens.
  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: new URL('/callback', c.req.url).href,
    }).toString(),
  });
  if (!tokenResp.ok) {
    return c.text('Failed to exchange authorization code with Google', 500);
  }
  const tokens = await tokenResp.json<{ access_token?: string }>();
  if (!tokens.access_token) {
    return c.text('Google did not return an access token', 500);
  }

  // Fetch the verified profile (email).
  const userResp = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userResp.ok) {
    return c.text('Failed to fetch Google user info', 500);
  }
  const user = await userResp.json<{
    email?: string;
    email_verified?: boolean;
    name?: string;
    sub?: string;
  }>();

  if (!user.email || user.email_verified === false) {
    return c.text('Google account has no verified email', 403);
  }

  const email = user.email.toLowerCase();

  // Authorization gate at the auth layer (defense in depth): only mint a token
  // for a known organizer. Non-organizers are rejected here so they never get a
  // token at all — the per-tool organizer checks remain as a second layer.
  if (!(await new OrganizerRepository(c.env.DB).isOrganizer(email))) {
    return c.text(
      `Access denied: ${email} is not an authorized organizer. Ask an existing organizer to add you.`,
      403,
    );
  }

  const props: Props = { email, name: user.name };

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    metadata: { label: user.name ?? user.email },
    props,
    request: oauthReqInfo,
    scope: oauthReqInfo.scope,
    userId: user.sub ?? user.email,
  });

  const headers = new Headers({ Location: redirectTo });
  if (clearSessionCookie) {
    headers.set('Set-Cookie', clearSessionCookie);
  }
  return new Response(null, { status: 302, headers });
});

export { app as GoogleHandler };
