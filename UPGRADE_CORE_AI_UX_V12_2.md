# Licia v12.2 — Core + AI + UX follow-up

Baseline: `licia-v12-core-ai-ux-upgraded.zip`

This release preserves every file from the baseline and adds focused fixes requested after review.

## Changes in this pass

### Focus
- Rebuilt the Focus layout with a responsive circular progress timer so the timer, controls, and context selectors no longer collide on narrow screens.
- Removed the old 1/10/120 minute preset buttons; manual duration remains the source of truth.
- Completion audio is now repeated by default **5×** and is adjustable from 1× to 10× in Settings or directly in Focus.
- AudioContext is initialized during the user-initiated start action to improve browser autoplay compatibility.
- Added optional `autoCompleteFocus` preference. When enabled, a task attached to a completed session is marked done.
- Added visible motion to Focus cards, the progress ring, and completion feedback.

### Settings
- Language is now a real application preference for the shell/navigation and Settings UI, using `id` / `en` state rather than only changing `<html lang>`.
- Added preferences for:
  - Focus sound repeat count
  - 12h / 24h clock
  - show/hide clock seconds
  - compact sidebar
  - mobile quick-search visibility
  - auto-complete attached Focus task
  - UI density
  - reduced motion
  - destructive-action confirmation
  - start page
  - week start
  - default Focus duration
- Runtime settings are persisted to Supabase JSON preferences and mirrored to localStorage where appropriate.
- Start-page redirect now supports Dashboard, Today, Brief, Focus, Inbox, Projects, and Chat.

### Navigation / layout
- Navigation labels now respond to language changes.
- Added a compact desktop sidebar mode without changing the underlying navigation.
- Quick Search can be hidden on mobile while remaining available on desktop.

### Health
- Removed the old activity summary / movement UI from the Health screen per request. Existing movement data is not deleted from storage.
- Food entries are now displayed only for the current local day, so yesterday's meals disappear from the journal after the day changes.
- Historical nutrition values remain in the database and continue contributing to stored nutrition summaries.
- Meal logging now calls the existing lightweight nutrition estimator and stores calories, protein, carbs, and fat when available.
- Added current-day calories/protein/caffeine summaries and a historical nutrition summary without showing old meal rows.

### Motion / visual system
- Added visible, restrained animation primitives for breathing, progress, shimmer, floating, and staggered card entry.
- Reduced-motion settings still disable these effects.

## Validation
- 68 TS/TSX source files parsed with TypeScript syntax diagnostics: 0 syntax failures.
- No baseline source files were removed.
- Added files: `components/LanguageProvider.tsx`, `lib/i18n.ts`.
- Full `npm install` / production build could not be completed in the audit environment because dependency installation did not finish; run `npm install` followed by `npm run build` locally or in CI.
