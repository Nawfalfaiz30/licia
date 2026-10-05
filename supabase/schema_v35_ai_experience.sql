-- ============================================================
-- LICIA V35 - AI AGENT / WATCHERS / PLANNING / RELIABILITY
-- Jalankan setelah V34 migrations.
-- ============================================================

create table if not exists public.ai_action_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text not null,
  mode text not null default 'preview' check (mode in ('preview','committed','cancelled','expired')),
  confidence numeric(5,4),
  risk text not null default 'normal' check (risk in ('low','normal','high','destructive')),
  actions jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists ai_action_plans_user_created_idx
  on public.ai_action_plans (user_id, created_at desc);
create index if not exists ai_action_plans_user_mode_idx
  on public.ai_action_plans (user_id, mode, created_at desc);

alter table public.ai_action_plans enable row level security;
drop policy if exists ai_action_plans_select on public.ai_action_plans;
drop policy if exists ai_action_plans_insert on public.ai_action_plans;
drop policy if exists ai_action_plans_update on public.ai_action_plans;
drop policy if exists ai_action_plans_delete on public.ai_action_plans;
create policy ai_action_plans_select on public.ai_action_plans for select using (user_id = auth.uid());
create policy ai_action_plans_insert on public.ai_action_plans for insert with check (user_id = auth.uid());
create policy ai_action_plans_update on public.ai_action_plans for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_action_plans_delete on public.ai_action_plans for delete using (user_id = auth.uid());

create table if not exists public.ai_watchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  entity_type text not null,
  condition jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  cooldown_minutes integer not null default 1440,
  last_triggered_at timestamptz,
  last_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_watchers_user_enabled_idx
  on public.ai_watchers (user_id, enabled, updated_at desc);

alter table public.ai_watchers enable row level security;
drop policy if exists ai_watchers_select on public.ai_watchers;
drop policy if exists ai_watchers_insert on public.ai_watchers;
drop policy if exists ai_watchers_update on public.ai_watchers;
drop policy if exists ai_watchers_delete on public.ai_watchers;
create policy ai_watchers_select on public.ai_watchers for select using (user_id = auth.uid());
create policy ai_watchers_insert on public.ai_watchers for insert with check (user_id = auth.uid());
create policy ai_watchers_update on public.ai_watchers for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_watchers_delete on public.ai_watchers for delete using (user_id = auth.uid());

create table if not exists public.ai_what_if_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_what_if_runs_user_created_idx
  on public.ai_what_if_runs (user_id, created_at desc);

alter table public.ai_what_if_runs enable row level security;
drop policy if exists ai_what_if_runs_select on public.ai_what_if_runs;
drop policy if exists ai_what_if_runs_insert on public.ai_what_if_runs;
create policy ai_what_if_runs_select on public.ai_what_if_runs for select using (user_id = auth.uid());
create policy ai_what_if_runs_insert on public.ai_what_if_runs for insert with check (user_id = auth.uid());

-- Optional dependency graph for planning. Existing applications can continue to work
-- without creating any dependencies.
create table if not exists public.life_os_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  relation text not null default 'blocks' check (relation in ('blocks','related')),
  created_at timestamptz not null default now(),
  unique (user_id, task_id, depends_on_task_id, relation),
  check (task_id <> depends_on_task_id)
);

create index if not exists life_os_task_dependencies_user_task_idx
  on public.life_os_task_dependencies (user_id, task_id);
create index if not exists life_os_task_dependencies_user_depends_idx
  on public.life_os_task_dependencies (user_id, depends_on_task_id);

alter table public.life_os_task_dependencies enable row level security;
drop policy if exists life_os_task_dependencies_select on public.life_os_task_dependencies;
drop policy if exists life_os_task_dependencies_insert on public.life_os_task_dependencies;
drop policy if exists life_os_task_dependencies_update on public.life_os_task_dependencies;
drop policy if exists life_os_task_dependencies_delete on public.life_os_task_dependencies;
create policy life_os_task_dependencies_select on public.life_os_task_dependencies for select using (user_id = auth.uid());
create policy life_os_task_dependencies_insert on public.life_os_task_dependencies for insert with check (user_id = auth.uid());
create policy life_os_task_dependencies_update on public.life_os_task_dependencies for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy life_os_task_dependencies_delete on public.life_os_task_dependencies for delete using (user_id = auth.uid());

-- Update timestamps for V35 records.
create or replace function public.licia_v35_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.licia_v35_touch_updated_at() from public, anon, authenticated;

drop trigger if exists trg_ai_action_plans_touch on public.ai_action_plans;
create trigger trg_ai_action_plans_touch before update on public.ai_action_plans for each row execute function public.licia_v35_touch_updated_at();
drop trigger if exists trg_ai_watchers_touch on public.ai_watchers;
create trigger trg_ai_watchers_touch before update on public.ai_watchers for each row execute function public.licia_v35_touch_updated_at();

-- Memory freshness / trust metadata. These fields are optional and backward-compatible.
alter table public.user_memories add column if not exists confidence numeric(5,4) not null default 1;
alter table public.user_memories add column if not exists importance numeric(5,4) not null default 0.5;
alter table public.user_memories add column if not exists last_confirmed_at timestamptz;
alter table public.user_memories add column if not exists expires_at timestamptz;
create index if not exists idx_memories_user_expiry on public.user_memories(user_id, enabled, expires_at);

-- Performance indexes for V35 intelligence reads.
create index if not exists notification_events_user_read_created_idx
  on public.notification_events (user_id, read_at, created_at desc);
create index if not exists habit_checkins_user_date_idx
  on public.habit_checkins (user_id, checkin_date desc);
create index if not exists pomodoro_user_started_idx
  on public.pomodoro_sessions (user_id, started_at desc);

-- Realtime for plan/watchers where available.
do $$
begin
  begin
    alter publication supabase_realtime add table public.ai_action_plans;
  exception when duplicate_object then null;
        when undefined_object then null;
        when insufficient_privilege then null;
  end;
  begin
    alter publication supabase_realtime add table public.ai_watchers;
  exception when duplicate_object then null;
        when undefined_object then null;
        when insufficient_privilege then null;
  end;
end $$;
