# Environment contract

## Core
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server only
- `OPENAI_API_KEY` — server only
- `NEXT_PUBLIC_SITE_URL`
- `APP_URL`

## AI
- `LICIA_AI_MODEL`
- `LICIA_AI_HEAVY_MODEL`
- `LICIA_AI_TOOL_MODEL`
- `LICIA_AI_FALLBACK_MODEL`
- `LICIA_AI_PROMPT_VERSION`
- `LICIA_AI_STRICT_TOOLS`
- `OPENAI_EMBEDDING_MODEL` — default `text-embedding-3-small`

## Integrations
- `LICIA_TOKEN_ENCRYPTION_KEY` — base64 32-byte server key
- `LICIA_BACKUP_ENCRYPTION_KEY` — base64 32-byte server key
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`

## Operations
- `LICIA_LOG_RETENTION_DAYS` — default 90
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
- `E2E_BASE_URL`
- GitHub repository variable `LICIA_E2E_ENABLED=true` to enable authenticated E2E.

Never commit real values. Preview/staging must use separate credentials and a non-production Supabase project or branch.
