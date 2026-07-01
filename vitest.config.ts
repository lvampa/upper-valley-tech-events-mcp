import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Runs tests inside the Workers runtime with the bindings from wrangler.jsonc
// (D1 "DB", KV "OAUTH_KV"). D1 is a local simulated database — the placeholder
// database_id in wrangler.jsonc is fine; nothing touches real Cloudflare.
//
// NOTE: this installed @cloudflare/vitest-pool-workers (0.16.x, vitest 4) ships
// the `cloudflareTest()` Vite plugin rather than the older `defineWorkersConfig`
// helper from the `/config` subpath (that subpath/export is absent here), so we
// wire the pool via the plugin. The options are the same WorkersPoolOptions
// that previously lived under poolOptions.workers.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  // Mirror the tsconfig `@/*` -> src/* path alias for vite's runtime resolution
  // (vite doesn't read tsconfig `paths`). The regex form matches only `@/...`,
  // so scoped package names like `@cloudflare/...` are left untouched.
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }],
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
