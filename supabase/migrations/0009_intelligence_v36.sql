-- Canonical migration: supabase/migrations/0009_intelligence_v36.sql
-- Source lineage: supabase/schema_v36_intelligence.sql

-- LICIA V36 — TRUST / EVIDENCE / PERSONALIZATION / INSIGHTS
-- Jalankan setelah migration V35.

alter table public.ai_action_plans add column if not exists evidence jsonb not null default '[]'::jsonb;
alter table public.ai_action_plans add column if not exists confidence_reason text;
alter table public.ai_action_plans add column if not exists preview_hash text;
alter table public.ai_action_plans add column if not exists applied_at timestamptz;
alter table public.ai_action_plans add column if not exists rollback_expires_at timestamptz;

create table if not exists public.ai_insight_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_key text not null,
  action text not null check (action in ('useful','not_useful','dismiss','snooze')),
  note text,
  created_at timestamptz not null default now(),
  unique(user_id, insight_key)
);
create index if not exists ai_insight_feedback_user_created_idx on public.ai_insight_feedback(user_id, created_at desc);
alter table public.ai_insight_feedback enable row level security;
drop policy if exists ai_insight_feedback_select on public.ai_insight_feedback;
drop policy if exists ai_insight_feedback_insert on public.ai_insight_feedback;
drop policy if exists ai_insight_feedback_update on public.ai_insight_feedback;
create policy ai_insight_feedback_select on public.ai_insight_feedback for select using (user_id = auth.uid());
create policy ai_insight_feedback_insert on public.ai_insight_feedback for insert with check (user_id = auth.uid());
create policy ai_insight_feedback_update on public.ai_insight_feedback for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.life_os_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  view_key text not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, view_key)
);
create index if not exists life_os_saved_views_user_updated_idx on public.life_os_saved_views(user_id, updated_at desc);
alter table public.life_os_saved_views enable row level security;
drop policy if exists life_os_saved_views_select on public.life_os_saved_views;
drop policy if exists life_os_saved_views_insert on public.life_os_saved_views;
drop policy if exists life_os_saved_views_update on public.life_os_saved_views;
drop policy if exists life_os_saved_views_delete on public.life_os_saved_views;
create policy life_os_saved_views_select on public.life_os_saved_views for select using (user_id = auth.uid());
create policy life_os_saved_views_insert on public.life_os_saved_views for insert with check (user_id = auth.uid());
create policy life_os_saved_views_update on public.life_os_saved_views for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy life_os_saved_views_delete on public.life_os_saved_views for delete using (user_id = auth.uid());

create or replace function public.licia_v36_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_life_os_saved_views_touch on public.life_os_saved_views;
create trigger trg_life_os_saved_views_touch before update on public.life_os_saved_views for each row execute function public.licia_v36_touch_updated_at();
