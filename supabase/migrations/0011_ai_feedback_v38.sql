-- Canonical migration: supabase/migrations/0011_ai_feedback_v38.sql
-- Source lineage: supabase/schema_v38_ai_feedback.sql

-- LICIA V38 — structured AI feedback metadata
-- Run after V36/V37 migrations.

alter table public.ai_insight_feedback
  add column if not exists feedback_category text,
  add column if not exists message_excerpt text,
  add column if not exists context jsonb not null default '{}'::jsonb;

create index if not exists ai_insight_feedback_user_action_idx
  on public.ai_insight_feedback(user_id, action, created_at desc);
