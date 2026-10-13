# Licia 3.0 — Implementation Plan

## Goal

Evolve Licia 2.0 into a premium, coherent Personal Life OS using the approved Figma Make direction ("Calm Intelligence") while preserving the working Supabase, authentication, AI API, sync, and domain-service foundations.

## Safe starting point

- Working branch: `licia-v3`
- Branch base: commit `15eed1c73fdaf932ebf71c6510b1c4c561e21de2` (`fix: allow unlimited AI daily token quota`)
- Source branch used by the current Production deployment: `codex/upgrade-p0-hardening`
- Production and `main` are not modified by this plan.

## Progress

- [x] Safe branch created from the latest production-source commit containing the AI token quota fix.
- [x] Baseline audit and phased implementation plan committed.
- [x] Phase 1 started: updated semantic light/dark surface tokens and the default Licia violet accent. Existing per-user theme/accent preferences remain supported.
- [ ] Refine shared app shell and global search entry point.
- [ ] Redesign dashboard composition while preserving dashboard widget personalization.

## Baseline audit: reuse before rebuilding

The current code already has several capabilities that Licia 3.0 should improve rather than duplicate:

- Shared app shell: `app/(app)/layout.tsx`
- Responsive/collapsible sidebar and grouped routes: `components/layout/Sidebar.tsx`, `components/layout/nav-items.ts`
- Top bar and global command palette entry point: `components/layout/TopBar.tsx`, `components/v35/CommandCenter.tsx`
- Dashboard widget ordering/visibility and personalization: `components/dashboard/DashboardLayoutProvider.tsx`, `components/dashboard/DashboardCustomizer.tsx`, `lib/dashboardLayout.ts`
- Existing cross-module search screen: `app/(app)/search/page.tsx`
- Existing combined Goals & Projects experience: `app/(app)/goals-projects/page.tsx`
- Existing insights and weekly review components: `components/v35/LifeInsights.tsx`, `components/v36/WeeklyReviewCard.tsx`
- Existing AI orchestration and usage logic: `lib/ai/chatOrchestrator.ts`, `lib/ai/usage.ts`

## Implementation phases

### Phase 0 — Safety and baseline (this branch)

1. Keep changes isolated on `licia-v3`.
2. Keep Production deployment, DB schema, RLS policies, Supabase migrations, and existing API contracts unchanged during the visual foundation work.
3. Record the baseline audit and roadmap in this file.
4. For each milestone, verify only intended files changed and run relevant checks where tooling is available.

Acceptance: branch starts from the current production source including the token-limit fix; no production alias or deployment is changed by the branch operation.

### Phase 1 — Visual foundation and app shell

1. Align light/dark semantic tokens with the approved warm-white / midnight-neutral / violet-indigo design direction.
2. Preserve user-configurable theme, accent, font, density, text scale, and accessibility behavior.
3. Refine the shared navigation shell: breadcrumb/page context, compact global search/command-palette trigger, notification placement, responsive spacing, collapsed-sidebar labels/tooltips, and mobile bottom navigation.
4. Normalize shared buttons, cards, page headings, borders, radii, spacing, focus states, and empty/loading/error states.
5. Do not duplicate global search if the existing command palette already serves the same use case.

Acceptance: shared shell looks consistent in light and dark themes, still supports mobile/keyboard/accessibility behaviors, and all existing routes remain available.

### Phase 2 — Dashboard and personalization

1. Audit the current dashboard data queries and widget system before changing its composition.
2. Apply the Figma direction to greeting, daily focus, upcoming agenda, actionable insight, task/schedule/focus/habit summaries, and lower-priority analytics.
3. Retain existing widget visibility/order and “today only” personalization; improve its discoverability and clarity rather than creating a competing preference system.
4. Use real user data; empty states must be honest, and AI insights must not be invented when data is missing.

Acceptance: useful priorities are visible quickly; dashboard customization persists; no data behavior/regression introduced.

### Phase 3 — AI Chat and contextual intelligence

1. Redesign chat composition and message hierarchy while preserving streaming, history, tool execution, mutation verification, undo, and confirmation behavior.
2. Distinguish recommendations, pending actions, successful actions, and failures visually.
3. Improve contextual source/related-entity summaries only where the current orchestrator provides reliable data.
4. Keep safety and authorization decisions server-side; frontend must not imply an action completed before the API confirms it.

Acceptance: core AI chat flows (ordinary answer, tool call, confirmation, failure, streaming, reload/history) remain functional.

### Phase 4 — Global search

1. Audit the command palette and `/search` page for coverage, relevance, keyboard flow, and duplicate entry points.
2. Improve search result grouping, type/status cues, snippets, empty/loading/error states, and mobile interactions.
3. Extend search coverage only after confirming data access, RLS, and available indexes; do not broaden privileged queries.
4. Keep command execution and entity search distinct in the UI when their results/actions differ.

Acceptance: keyboard search and dedicated search both remain available as appropriate, results navigate to correct modules, and no new RLS/security exposure is introduced.

### Phase 5 — Connected life planning and goals

1. Audit existing Goal, Project, Task, Calendar, and Focus relationships and available fields.
2. Improve the path from goal → milestone/project → task → scheduled work → review using existing relationships first.
3. Make missing relationships and next steps clear; avoid inventing progress or silently changing data.
4. Add backend/schema changes only when the audit identifies a concrete gap and the migration can be reviewed independently.

Acceptance: links and progress reflect persisted data; existing CRUD and synchronization flows remain intact.

### Phase 6 — Proactive automation and recommendations

1. Audit current automation, reminders, insights, and proactive-event budgeting before adding new mechanisms.
2. Prioritize transparent, configurable recommendations with a reason, source context, and explicit next action.
3. Respect user preferences, quotas/budgets, time zone, and permission boundaries.
4. Require confirmation for consequential mutations and expose outcomes/failures clearly.

Acceptance: no duplicate schedulers or new automatic mutations without safeguards; recommendations can be explained and dismissed/acted on.

### Phase 7 — Remaining modules and release gate

1. Apply the design system to Finance, Calendar, Tasks, Habits/Health, Knowledge, Insights, Analytics, Settings, and secondary modules.
2. Verify desktop/tablet/mobile layouts, long Indonesian text, empty/loading/error states, keyboard/focus, reduced motion, and contrast.
3. Run typecheck, lint, formatting checks, unit/regression tests, security checks, migration verification, and production build.
4. Deploy to a Vercel Preview first; inspect real routes and runtime behavior before considering Production promotion.

Acceptance: required checks pass or have documented pre-existing failures; preview review finds no blocker; no Production promotion occurs automatically.

## Feature priorities

1. Contextual AI experience
2. Better global search
3. More connected life planning and goals
4. Dashboard personalization
5. Proactive automation and recommendations
6. Additional features only after the baseline audit

## Change-control rules

- Keep implementation commits small and focused.
- Prefer reusing current components/services over rewriting.
- No schema, migration, authentication, RLS, or API-contract changes in purely visual commits.
- Do not silently remove routes or features.
- Verify changed-file lists per commit.
- Production deployment and aliases remain untouched until explicitly approved.
