-- Licia V37: agenda completion + lightweight workspace metadata.
-- Run this migration once in Supabase SQL Editor after the existing schema.

alter table public.schedule_blocks
  add column if not exists completed_at timestamptz;

create index if not exists idx_schedule_user_completed
  on public.schedule_blocks (user_id, completed_at, block_date);

comment on column public.schedule_blocks.completed_at is
  'V37: waktu agenda ditandai selesai; null berarti belum selesai.';
