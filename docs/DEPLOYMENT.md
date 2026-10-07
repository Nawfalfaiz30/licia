# Deployment topology

Recommended production topology:

Vercel: Next.js UI + light API
-> Supabase Auth/Postgres/Realtime

Single reminder dispatcher:
VPS/PM2 worker OR Vercel Cron/Supabase scheduled function

Preview must use a non-production Supabase project/branch and non-production service credentials.

Before release:

npm ci
npm run preflight
npm run typecheck
npm run lint
npm run format:check
npm run i18n:check
npm run db:verify
npm run audit
npm test
npm run eval:gate
npm run build
