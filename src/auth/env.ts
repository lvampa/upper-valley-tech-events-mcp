// Zod-validated OAuth configuration for the Worker.
//
// Only the string config/secrets are validated here — NOT the platform
// bindings (DB, OAUTH_KV), which are runtime objects provided by the platform.
// parseConfig() is called on the OAuth paths only; the public GET /events read
// path must keep working even when these secrets are absent.

import { z } from 'zod';
import { type Env } from '@/types.ts';
import { OAuthError } from './workers-oauth-utils.ts';

const configSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  COOKIE_ENCRYPTION_KEY: z.string().min(1),
  ALLOWED_ORIGIN: z.url().optional(),
});

export type Config = z.infer<typeof configSchema>;

export function parseConfig(env: Env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new OAuthError('server_error', `Invalid or missing configuration: ${fields}`, 500);
  }
  return result.data;
}
