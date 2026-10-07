# Licia Architecture

User -> Next.js/PWA -> Route Handlers
-> AI Runtime -> Context/Router/Tools -> Supabase
-> Domain Services -> Event Bus -> Reminders/Push
-> Sync API -> Version/Conflict/Replay

## Reliability contract

AI mutations use UNDERSTAND -> ROUTE -> VALIDATE -> ACT -> VERIFY -> RESPOND. A success claim requires a verified database result. Destructive operations require explicit target confirmation. Batch actions have an auditable batch ID and undo snapshots where available.

## Performance contract

Prefer keyset pagination, narrow columns, concurrent independent reads, serial mutations, Realtime invalidation over polling, and bounded AI context. Dashboard widgets should render independently so a slow module cannot block the first paint.

## Security contract

Browser-origin checks, user-scoped RLS, restricted admin client usage, rate limiting, request IDs, and server-only credentials are required for sensitive routes.
