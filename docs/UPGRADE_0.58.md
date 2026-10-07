# Licia 0.58.0 - PDF upgrade map

Source: "Analisis Repo Licia dan Rekomendasi Pengembangan", dated 7 October 2026.

## Security

Implemented:
- Gitleaks configuration and GitHub secret-scanning workflow.
- CodeQL and npm audit workflow.
- Local secret hygiene script.
- SECURITY.md and pull-request security checklist.
- Vault envelope v2 with PBKDF2-SHA256 600,000 iterations and transparent v1 read/migration.
- Request IDs and AI privacy preferences.
- RLS-oriented maintenance functions and observability tables.
- Branch-ready CI quality gates.

Owner actions still required:
- Rotate credentials if old public history ever contained real secrets.
- Enable GitHub push protection and branch protection in repository settings.
- Use separate Supabase and Vercel environments.

## AI

Implemented:
- Versioned single tool-schema registry with optional strict schemas.
- Hybrid FTS plus pgvector retrieval RPC and AI search tool.
- Indexing hooks for notes, memories, decisions, and reading.
- Curated memory metadata fields.
- AI request tracing.
- Bounded proactive policy with quiet hours and daily limits.
- Model health endpoint.
- 150-case evaluation gate and seed corpus.
- Finance, Health, and private-mode context exclusions.

Still credential/provider dependent:
- LLM-as-judge execution and actual 150-case scoring.
- Production trace backend such as Sentry, Langfuse, or OpenTelemetry collector.
- Batch API for nightly analytics.

## UX and PWA

Implemented:
- Core navigation model and legacy redirects.
- Today as default authenticated home.
- SSR public landing page with metadata.
- Web Vitals collection for LCP, INP, and CLS.
- Service-worker version bump and user-accepted update behavior.
- Lucide import optimization.
- Playwright configuration and critical-flow suite.

Still to tune with product analytics:
- Gesture polish, adaptive onboarding, component catalog/Storybook, accessibility device pass, and exact dashboard widget streaming after measuring real bundle and page costs.

## Integrations

Implemented infrastructure:
- Google Calendar OAuth start/callback, encrypted server-side token storage, primary-calendar incremental sync cursor, and two-way schedule mapping.
- Generic inbound capture token flow suitable for Telegram, WhatsApp, and email bridges.
- Automation webhook management and durable event queue.
- CSV, ICS, and Markdown parser primitives.
- Playbook seed templates.
- Saved smart-list API.
- Encrypted scheduled-backup worker.

Provider and device setup still required:
- Google Cloud OAuth client and redirect URI.
- Telegram, WhatsApp, and email provider webhook bridge.
- Object-storage bucket and backup encryption key.
- Native Android packaging and device testing.
- Health Connect and Android widgets require Android SDK dependencies and device-side implementation/testing.

## DevOps

Implemented:
- Parallel CI static, unit, eval, and build stages.
- Optional Playwright E2E stage.
- Dependabot.
- Migration policy and deployment documentation.
- SemVer 0.58.0 alignment.

## Verification status

This branch was edited through GitHub connectors. The environment available to this session could not start a Vercel sandbox, so I did not claim a successful local typecheck, build, or test run. CI is configured to perform those checks on GitHub.
