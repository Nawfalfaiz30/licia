# Security Policy

## Supported versions

Security fixes target the latest main release and the active upgrade branch.

## Reporting a vulnerability

Do not open a public GitHub issue with credentials, tokens, personal data, or exploit details. Contact the repository owner privately and include the affected route/file, impact, reproduction steps, and a safe proof of concept when available.

## Secret exposure

If a secret may have entered Git history, revoke or rotate it first, then remove the secret from repository history. Removing only the latest file is not sufficient.

## Production rules

- Server-only credentials must never use a NEXT_PUBLIC_ prefix.
- Preview and staging must not reuse production service-role credentials.
- AI, finance, health, Vault, export, restore, account transfer, and account-deletion operations must remain user-scoped and audited.
