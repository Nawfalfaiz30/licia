-- LICIA V38 — structured AI feedback metadata
-- Run after V36/V37 migrations.

alter table public.ai_insight_feedback
  add column if not exists feedback_category text,
  add column if not exists message_excerpt text,
  add column if not exists context jsonb not null default '{}'::jsonb;

create index if not exists ai_insight_feedback_user_action_idx
  on public.ai_insight_feedback(user_id, action, created_at desc);
