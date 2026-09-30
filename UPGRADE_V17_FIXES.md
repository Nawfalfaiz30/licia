# Licia v17 — Error Fixes & Small UX Adjustments

Baseline: Licia v16 Stabilized Production Ready.

## Fixed
- Pusat Otomatisasi: removed accidental `needle2` render reference that caused runtime error; automation page rewritten with normal readable JSX while preserving functionality.
- Timeline notes: strip common markdown markers (`###`, `**`, `__`, backticks, list markers) before display so notes read as clean text.
- Timeline details: replaced centered modal with a responsive right-side drawer on desktop and bottom sheet on mobile.
- Search/notification overlays: increased stacking order and topbar isolation so opened panels stay above page content.
- Search page: removed invalid `description` filters from task/project/goal queries because those columns are not part of the current schema.

## UX improvements
- Quick Search remains a small header button and now doubles as a compact launcher for less-visible modules.
- Search coverage expanded to tasks, projects, goals, notes, inbox, reading, subscriptions, decisions, learning, areas, memory, Vault, automation, and calendar.
- Tanya Licia page-level hero removed; ChatWidget uses a compact app-like header and mode selector.
- Dashboard: fixed duplicate stat rendering and added a compact “Pusat kendali hari ini” action strip.

## Validation
- 88 TS/TSX files parsed successfully with 0 syntax errors.
- Project `npm run verify` passed.
- No `needle2`, `CommandPalette`, or `Ctrl+K` remnants found.
- No `description.ilike` remains in the search page.

## Production note
A full `npm run build` remains to be verified in an environment where npm dependencies can be installed successfully. The audit environment previously timed out while resolving the npm registry, so no incomplete lockfile was committed.
