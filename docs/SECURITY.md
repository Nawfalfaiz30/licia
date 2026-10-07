# Security & Privacy

## Secret handling

Credentials belong only in Vercel or VPS environment variables. .env files are blocked by Git ignore and the security workflow scans repository history for leaked values.

## User isolation

All user-facing routes authenticate first. Data access is user-scoped through Supabase RLS. Server admin clients are reserved for worker, restore, and diagnostic paths that explicitly need them.

## AI privacy

AI context should be minimized by domain. Finance and health can be excluded from AI context through explicit preferences. Private mode disables conversational persistence where supported. Vault plaintext is never embedded on the server.

## Operational logs

AI, notification, and sync logs are retained for a bounded period and pruned by a scheduled maintenance job.

## Incident response

1. Revoke the exposed credential.
2. Confirm no production deployment uses the revoked value.
3. Remove leaked material from Git history.
4. Review provider logs and Licia audit trails.
5. Rotate dependent secrets and document the incident.
