# Deployment topology

Recommended production topology:

Vercel: Next.js UI + light API
-> Supabase Auth/Postgres/Realtime

Single reminder dispatcher:
VPS/PM2 worker OR Vercel Cron/Supabase scheduled function

Preview must use a non-production Supabase project/branch and non-production service credentials.

Before release:

```bash
npm ci
npm run preflight
npm run typecheck
npm run lint
npm run format:check:changed
npm run api:auth:check
npm run i18n:check
npm run db:verify
npm run audit
npm test
npm run eval:gate
npm run build
```

`/api/health` requires a user session and returns operational detail for the System screen. Use `/api/healthz` for public uptime checks; its response does not disclose configuration or feature-level diagnostics. Apply the latest timestamped migration to staging and verify the distributed limiter RPC before deploying code that requires it. AI requests use a 20,000 token per-user rolling 24-hour limit by default. Set `LICIA_AI_DAILY_TOKEN_LIMIT` to a higher positive value to change the cap.
