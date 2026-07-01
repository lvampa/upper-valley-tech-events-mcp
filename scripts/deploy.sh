#!/usr/bin/env bash
# Production deploy — the single source of truth, run identically from CI or
# locally. Gates on the full check suite, applies D1 migrations (schema before
# code), then deploys the Worker.
#
# Auth: CI sets CLOUDFLARE_API_TOKEN in the environment (wrangler reads it
# automatically); locally, authenticate once with `wrangler login`.
set -euo pipefail

# Load local secrets (CLOUDFLARE_API_TOKEN, etc.) if present. In CI there is no
# .env — the token comes from the GitHub environment instead.
if [ -f .env ]; then set -a; . ./.env; set +a; fi

echo "▶ lint";            npm run lint
echo "▶ format check";    npm run format:check
echo "▶ typecheck";       npm run typecheck
echo "▶ test";            npm test
echo "▶ migrate (remote)"; npx wrangler d1 migrations apply uvt-events --remote
echo "▶ deploy";          npx wrangler deploy
echo "✓ deployed"
