# Licia V25 — Information-first UI Refresh

Baseline: `licia-v24.2-major-ui-ai-local.zip`

## Scope
Focused on the four user-requested areas:
- Quick Search mobile popup
- Dashboard / Personal Home
- Guide / Help Center
- Settings / Control Center

No external integrations were added.

## Quick Search
- Replaced long mobile shortcut grid with compact quick-access tiles (6 primary links).
- Added direct `Semua data`, Capture, Chat, and Life Command actions.
- Mobile search panel is a fixed, viewport-aware sheet with internal scrolling and safe bottom spacing.
- Added explicit close button so the panel does not get trapped behind the viewport.
- Search results remain compact and preserve direct navigation to source modules.

## Dashboard
- Rebuilt as an information hub rather than a navigation rail.
- Hero contains only two actions: Tanya Licia and Tangkap.
- Summary cards expose tasks, agenda, projects, goals, inbox, focus, notes, and memory.
- Finance summary uses running balance plus current-month income, expense, and net flow.
- Added attention section for overdue tasks and unprocessed Inbox.
- Added next-step card, today's agenda, active goals, upcoming agenda, recent captures/notes, and a compact overview of personal systems (habits, skills, reading, decisions, vault, automations, subscriptions, health).
- Summary items are clickable and navigate to the source module.

## Guide
- Expanded to 30+ guide topics covering all primary application routes and major workflows.
- Added category filters: Mulai, Produktivitas, Personal OS, AI & Otomasi.
- Added searchable accordion content with direct module buttons.
- Added explicit PWA/offline and AI bulk-action guidance.

## Settings
- Rebuilt as a tabbed Control Center to avoid a long, flat wall of settings.
- Tabs: Tampilan, AI, Workspace, Pengalaman, Data & akun.
- Added compact identity section, theme toggle, density choices, accent presets, background presets, and font presets.
- AI access, suggestion, confirmation, and response-length controls preserved.
- Workspace defaults and notification/motion/PWA preferences preserved.
- Data Export and Health Check restored/prominently exposed.
- Mobile logout remains visible through the existing account action.

## Validation
- `node scripts/verify.mjs`: PASS
- 101 TS/TSX files parser-checked: 0 syntax errors
- CSS parse via tinycss2: 0 parse errors
- CSS braces balanced: 664 / 664
- Literal `\\n` corruption: 0
- Runtime `localhost:3000` in app/components: 0

## Local build
Run locally:
```powershell
npm install
npm run preflight
npm run verify
npm run build
```

Do not deploy to VPS until the build and manual UI smoke tests pass.
