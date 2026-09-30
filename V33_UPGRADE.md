# Licia V33 — Experience, Sync & Performance Upgrade

V33 consolidates Licia into a stronger multi-device Personal Life OS.

## Included
- Universal sync mutation flow with idempotency and optimistic version checks.
- Server-recorded conflict history and conflict resolver (`server`, `latest`, `manual`, `smart`).
- Resync detection after sync-history pruning.
- Device registry, sync center and live sync status.
- Cross-device preference synchronization and offline mutation queue.
- Service worker background replay for queued mutations.
- Entity links foundation for Life Graph relationships.
- Daily snapshot storage and targeted performance indexes.
- Motion runtime with reduced-motion support, ripple interactions and page/sheet transitions.
- Voice capture using browser speech recognition with configurable language.
- Global Quick Capture improvements and Sync Center navigation.
- V33 PWA cache generation.

## Production prerequisites
1. Rotate any leaked credentials from earlier development archives.
2. Configure Supabase URL/anon key and server-only service-role key in the VPS environment.
3. Generate/configure VAPID keys and `LICIA_CRON_SECRET`.
4. Apply migrations in order: V30 core → V31 sync → V32 sync experience → V33 Life OS.
5. Run `npm run verify` and `npm run audit`.
6. Build and start the web app plus reminder worker/cron.

## Recommended runtime
- Next.js application process via PM2/systemd.
- Reminder dispatcher on a server-side cron/worker, not browser polling.
- Supabase Realtime enabled for `life_os_sync_events` and `life_os_sync_conflicts`.

## Final hardening included

- Fresh-device preference bootstrap through `/api/sync/preferences` so a newly installed device does not start with stale local settings.
- Dashboard server-side user cache (short TTL) to reduce repeat query cost during rapid navigation.
- Dashboard/context cache invalidation after successful Sync Core mutations and AI actions.
- Life Graph now reads `life_os_entity_links` and exposes cross-module relationships instead of only inferred Goal → Project → Task links.
- Mobile sync indicator is visible when useful, including offline, resync, conflict, and active synchronization states.
- README documents the full V33 upgrade and migration flow.
