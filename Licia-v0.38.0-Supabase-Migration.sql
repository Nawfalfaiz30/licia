-- Licia 0.38.0 — combined migration for V37 + V38
-- Jalankan setelah schema utama Licia.

-- V37: agenda completion
alter table public.schedule_blocks
  add column if not exists completed_at timestamptz;

create index if not exists idx_schedule_user_completed
  on public.schedule_blocks (user_id, completed_at, block_date);

comment on column public.schedule_blocks.completed_at is
  'V37: waktu agenda ditandai selesai; null berarti belum selesai.';

-- V38: structured AI feedback metadata
alter table public.ai_insight_feedback
  add column if not exists feedback_category text,
  add column if not exists message_excerpt text,
  add column if not exists context jsonb not null default '{}'::jsonb;

create index if not exists ai_insight_feedback_user_action_idx
  on public.ai_insight_feedback(user_id, action, created_at desc);
