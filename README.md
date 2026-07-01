# UVT Events Service

Cloudflare Worker backing the Upper Valley Tech meetup site.

- `GET /events` — public JSON of scheduled events, edge-cached 5 min.
- `/mcp` — remote MCP server (Streamable HTTP), Google OAuth, organizer-only.

## Architecture

`src/index.ts` serves `GET /events` (from cache or `EventRepository`) and hands
everything else to
[`@cloudflare/workers-oauth-provider`](https://www.npmjs.com/package/@cloudflare/workers-oauth-provider),
which runs the OAuth endpoints and gates `/mcp`. Login is delegated to Google
(`src/auth/`); the verified email rides in the token props.

Writes are layered **MCP tool → service → repository → D1**:

- Repositories (`src/events/*-repository.ts`) implement the `EventStore` /
  `OrganizerStore` interfaces over D1.
- Services extend `OrganizerGatedService`, whose `gate()` enforces the organizer
  check once — no tool body runs without it. `/callback` re-checks at login, so
  non-organizers never get a token.
- Writes call `EventsCache.purge()` to refresh `/events`. Inputs validated with Zod.

### MCP tools

| Tool            | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `list_events`   | List all events incl. cancelled.                   |
| `add_event`     | Create an event (id derived from date if omitted). |
| `update_event`  | Patch fields of an event by id.                    |
| `cancel_event`  | Set `status = 'cancelled'` by id.                  |
| `add_organizer` | Add an email to the `organizers` allowlist.        |

## Local development

```sh
npm install
npm run db:seed:local   # local D1: migrations + prod seed + dev sample events
npm run dev             # wrangler dev
```

`GET /events` works locally against the seeded dev data. The OAuth flow needs real
Google secrets, so `/authorize` returns 500 and `/mcp` returns 401 without them —
expected.

Checks (all also run in CI and by the deploy script):

```sh
npm run lint          # eslint — strict, type-checked
npm run format:check  # prettier (npm run format to write)
npm run typecheck     # tsc --noEmit
npm test              # vitest
```

## Branches & deploys

- **`main`** — dev / PR work. Every PR runs lint + format + typecheck + tests (CI).
- **`production`** — deploys on push. CI runs `./scripts/deploy.sh`: the same
  checks, then `d1 migrations apply --remote`, then `wrangler deploy`.

Deploy manually with the identical script:

```sh
wrangler login
npm run deploy
```

## One-time setup

```sh
# D1 + KV — paste the returned ids into wrangler.jsonc.
wrangler d1 create uvt-events
wrangler kv namespace create OAUTH_KV

# Bootstrap the first organizer (edit db/seed.sql first for a different email).
wrangler d1 migrations apply uvt-events --remote
wrangler d1 execute uvt-events --remote --file=./db/seed.sql

# Worker secrets — stay in Cloudflare, not needed in CI.
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY   # openssl rand -hex 32
```

**Google OAuth client** (Web application) at
[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials):
redirect URI `https://<worker-url>/callback`, scopes `openid email profile`. While
the consent screen is "Testing", add each organizer under Test users.

**CI deploys:** store `CLOUDFLARE_API_TOKEN` as a secret on a GitHub **`production`
environment** (Settings → Environments — lets you gate prod behind approval), not a
plain repo secret. Scope the token to the account + `uppervalleytech.org` zone:

| Scope   | Permission               |
| ------- | ------------------------ |
| Account | Workers Scripts: Edit    |
| Account | D1: Edit                 |
| Account | Workers KV Storage: Edit |
| Account | Account Settings: Read   |
| Zone    | Workers Routes: Edit     |

Add **Zone → DNS: Edit** if the custom-domain deploy fails.

## Connect from Claude.ai

Settings → Connectors → add `https://<worker-url>/mcp`, then complete the Google
login. The tools work for any email in the `organizers` table.

## Organizers

Call `add_organizer` as an existing organizer, or insert directly (emails stored
lower-cased, matched case-insensitively):

```sh
wrangler d1 execute uvt-events --remote \
  --command "INSERT OR IGNORE INTO organizers (email, added_by) VALUES ('x@example.com', 'manual')"
```
