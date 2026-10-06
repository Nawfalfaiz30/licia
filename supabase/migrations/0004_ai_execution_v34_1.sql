-- Canonical migration: supabase/migrations/0004_ai_execution_v34_1.sql
-- Source lineage: supabase/schema_v34_1_ai_execution.sql

-- LICIA V34.1 - Robust AI batch execution metadata

alter table if exists public.ai_pending_actions add column if not exists completed_actions integer not null default 0;
alter table if exists public.ai_pending_actions add column if not exists failed_actions integer not null default 0;
alter table if exists public.ai_pending_actions add column if not exists error_summary text;
alter table if exists public.ai_pending_actions add column if not exists execution_result jsonb not null default '{}'::jsonb;
create index if not exists idx_ai_pending_user_execution on public.ai_pending_actions(user_id, applied_at desc);
comment on column public.ai_pending_actions.execution_result is 'Hasil terstruktur eksekusi batch AI: completed, failed, partial/failed status, dan rincian aksi.';

-- Refresh PostgREST schema cache immediately after adding V34.1 columns.
notify pgrst, 'reload schema';
