# Licia v19 — Performance, Chat Polish & VPS Readiness

Base: user-provided `licia-v18-error-fixes(1).zip`.

## Non-functional changes only

- Removed the floating per-message delete button in Chat; the only per-message delete control is now beside the message timestamp.
- Memoized chat bubbles and stabilized the delete callback so typing does not re-render the full 40-message list.
- Reduced global notification overhead by adding a lightweight notification-only intelligence path and removing continuous background automation/intelligence polling.
- Daily Intelligence refreshes on initial load, window focus, visibility changes, and preference changes instead of polling every 2 minutes.
- Kept all existing animation classes/effects; performance improvements avoid unnecessary re-renders and font preloads rather than removing motion.
- Optional Google fonts remain selectable but are no longer all preloaded.
- `npm run build` now uses a portable Node build helper with a default 1024 MB V8 heap for low-memory VPS builds.
- Dev Tunnel / VS Code Forward Port origins (`*.devtunnels.ms`, `*.app.github.dev`, `*.github.dev`, `*.githubpreview.dev`) are accepted only in non-production by the same-origin guard; production remains allow-listed through `NEXT_PUBLIC_SITE_URL`, `APP_URL`, or `DEV_TUNNEL_ORIGIN`.
- Added an optional `DEV_TUNNEL_ORIGIN` environment variable for explicit local-dev configuration.
- Bumped the service-worker cache name to invalidate stale shell assets.
- Preserved PWA, AI, search, notifications, animations, and all application routes.

## Verification

- 89 TS/TSX files parsed with zero syntax errors.
- Zero missing local imports.
- Zero forbidden stale files (`components/PwaRegister.tsx`, `app/(app)/settings/page.client.tsx`, `components/layout/CommandPalette.tsx`).
- Zero detected API secrets in source.
- Package JSON parses successfully.

## Build limitation

The audit environment does not have the project's npm dependencies cached and registry installation timed out, so a full `next build` cannot be truthfully claimed here. Run `npm install`, `npm run verify`, and `npm run build` on the target VPS.
