# Licia V36.1 — Stability & Experience Fixes

Patch release focused on the issues found after the V36.0 build and first real-device test.

## 1. Web Push repair

- Browser subscriptions now detect a VAPID public-key change and transparently rebind the device subscription.
- The current VAPID public key is remembered locally to catch stale subscriptions after deployment/key rotation.
- Server push delivery treats invalid subscriptions (400/401/403/404/410) as repairable and removes stale records.
- The push test endpoint returns a repairable signal and the settings control can repair + retry automatically.
- Push status now distinguishes a stale subscription from a healthy subscription.

## 2. AI Action History deletion

- Added `DELETE /api/ai/history` for deleting a single action history item or the current user's full history.
- Added per-item delete buttons and a clear-history action.
- Deleting history never undoes the underlying data mutation; Undo remains a separate operation.

## 3. Clear AI roles

Licia now explains three time horizons consistently:

- **Life Copilot** — current state / now: risks, evidence, agenda, priorities, next move.
- **Perencana Mingguan AI** — next 7 days: generate a proposed weekly schedule and optionally apply it to Calendar.
- **Review Mingguan** — previous 7 days: inspect what actually happened, progress, focus, and patterns.

The same explanation appears in Dashboard, Copilot, Planner, Review Center, and Settings.

## 4. Dashboard & Settings refresh

- Dashboard includes a compact AI horizon guide alongside Life Copilot.
- Settings gains the same AI horizon guide plus clearer quick links.
- Push polling text is now explicitly described as fallback polling, not push delivery timing.
- Reminder lead window is clarified so it is not confused with toast duration.

## 5. Finance & Routines

### Finance Intelligence

- Month-over-month expense change.
- Budget risk count at 80%+ utilization.
- Subscriptions due within 30 days.
- Largest current expense category.
- Context-aware finance guidance and a direct “Tanya Licia” path.

### Routine Intelligence

- Remaining routines for today.
- Routines whose current streak is at risk.
- Scheduled routines for today.
- Quick check-in queue ordered by preferred time.
- Copy explicitly avoids treating streaks as a requirement for “perfect” behavior.

## 6. Notification & visual polish

- Notification panel is fixed beneath the application chrome instead of depending on the bell container.
- Persistent notifications are deduplicated against already push-delivered events when browser fallback notifications are enabled.
- Notification tone icons now distinguish danger, warning, success, info, and neutral AI signals.
- Reminder titles remove the generic `Pengingat:` prefix in the visual notification center.
- Individual notification deletion is available.
- Toasts now appear below the top application chrome and use tone-aware progress bars.
- Existing reduced-motion/motion-off settings continue to disable animation.

## Verification

- V36 test suite passes.
- V36.1 static feature checks pass.
- All TypeScript/TSX source files pass TypeScript syntactic parsing with zero parse diagnostics.
- Full production build still depends on installing the project's dependency set and production environment configuration on the deployment machine.
