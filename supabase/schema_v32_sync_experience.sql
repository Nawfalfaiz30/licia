-- ============================================================
-- LICIA V32 - SYNC RELIABILITY / CONFLICTS / PREFERENCES / UX
-- Jalankan setelah schema_v31_sync.sql dan schema_v30_core_intelligence.sql
-- ============================================================

alter table public.life_os_sync_devices
  add column if not exists last_cursor bigint not null default 0,
  add column if not exists sync_status text not null default 'online',
  add column if not exists last_error text;

create index if not exists life_os_sync_devices_user_seen_idx
  on public.life_os_sync_devices (user_id, last_seen_at desc);

create table if not exists public.life_os_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  mutation_id text not null,
  entity_type text not null,
  entity_id uuid,
  strategy text not null default 'manual',
  client_version integer,
  server_version integer,
  client_payload jsonb not null default '{}'::jsonb,
  server_payload jsonb not null default '{}'::jsonb,
  conflicting_fields jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','resolved','discarded')),
  resolution text,
  resolved_payload jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists life_os_sync_conflicts_user_status_idx
  on public.life_os_sync_conflicts (user_id, status, created_at desc);
create unique index if not exists life_os_sync_conflicts_mutation_idx
  on public.life_os_sync_conflicts (user_id, mutation_id);

alter table public.life_os_sync_conflicts enable row level security;
drop policy if exists life_os_sync_conflicts_select on public.life_os_sync_conflicts;
create policy life_os_sync_conflicts_select on public.life_os_sync_conflicts
  for select using (user_id = auth.uid());

-- Keep mutation bookkeeping server-authoritative in V32.
drop policy if exists life_os_sync_mutations_insert on public.life_os_sync_mutations;
drop policy if exists life_os_sync_mutations_update on public.life_os_sync_mutations;

-- Account preference change events are lightweight and allow another tab/device to refresh.
do $$
begin
  if to_regclass('public.users') is not null then
    execute $fn$
      create or replace function public.licia_write_preference_event()
      returns trigger
      security definer
      set search_path = public
      language plpgsql
      as $body$
      begin
        if coalesce(old.preferences::text, '') is distinct from coalesce(new.preferences::text, '') then
          insert into public.life_os_sync_events (user_id, entity_type, entity_id, operation, payload)
          values (new.id, 'preferences', new.id, 'update', jsonb_build_object('preferences', coalesce(new.preferences, '{}'::jsonb), 'updated_at', now()));
        end if;
        return new;
      end;
      $body$;
    $fn$;

    execute 'drop trigger if exists trg_users_preferences_sync_event on public.users';
    execute 'create trigger trg_users_preferences_sync_event after update of preferences on public.users for each row execute function public.licia_write_preference_event()';
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.life_os_sync_conflicts;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when insufficient_privilege then null;
  end;
end $$;

-- Performance indexes for the main sync-driven domains.
create index if not exists tasks_user_updated_at_idx on public.tasks (user_id, updated_at desc);
create index if not exists schedule_blocks_user_date_time_idx on public.schedule_blocks (user_id, block_date, start_time);
create index if not exists projects_user_updated_at_idx on public.projects (user_id, updated_at desc);
create index if not exists goals_user_updated_at_idx on public.goals (user_id, updated_at desc);
create index if not exists brain_dump_notes_user_updated_at_idx on public.brain_dump_notes (user_id, updated_at desc);
create index if not exists smart_inbox_items_user_created_at_idx on public.smart_inbox_items (user_id, created_at desc);
create index if not exists reminders_user_remind_at_idx on public.reminders (user_id, remind_at);
create index if not exists user_memories_user_updated_at_idx on public.user_memories (user_id, updated_at desc);


-- Optional housekeeping helper. Run from a trusted scheduler once per day.
create or replace function public.licia_prune_sync_history(_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(30, least(_days, 365)));
  event_count integer := 0;
  mutation_count integer := 0;
  conflict_count integer := 0;
begin
  delete from public.life_os_sync_conflicts where status <> 'open' and coalesce(resolved_at, created_at) < cutoff;
  get diagnostics conflict_count = row_count;
  delete from public.life_os_sync_mutations where status <> 'processing' and created_at < cutoff;
  get diagnostics mutation_count = row_count;
  delete from public.life_os_sync_events where created_at < cutoff;
  get diagnostics event_count = row_count;
  return jsonb_build_object('events', event_count, 'mutations', mutation_count, 'conflicts', conflict_count, 'cutoff', cutoff);
end;
$$;

revoke all on function public.licia_prune_sync_history(integer) from public, anon, authenticated;

create index if not exists life_os_sync_mutations_status_created_idx
  on public.life_os_sync_mutations (status, created_at);
create index if not exists life_os_sync_events_user_entity_idx
  on public.life_os_sync_events (user_id, entity_type, entity_id, sequence desc);


-- Extend V32 Sync Core to operational, finance, health, learning, and relationship records.
do $$
declare
  _tbl text;
begin
  foreach _tbl in array array[
    'subtasks','goal_milestones','decisions','skills',
    'expenses','incomes','subscriptions',
    'sleep_logs','hydration_logs','caffeine_logs','meal_logs','medication_logs',
    'fatigue_logs','movement_logs','health_metrics',
    'pomodoro_sessions','habits','habit_checkins',
    'reading_logs','reading_sessions','social_relations','social_interactions'
  ] loop
    begin
      execute format('alter table public.%I add column if not exists version integer not null default 1', _tbl);
      execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', _tbl);
      execute format('drop trigger if exists %I on public.%I', 'trg_'||_tbl||'_version', _tbl);
      execute format('create trigger %I before update on public.%I for each row execute function public.licia_bump_version()', 'trg_'||_tbl||'_version', _tbl);
      execute format('drop trigger if exists %I on public.%I', 'trg_'||_tbl||'_sync_event', _tbl);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.licia_write_sync_event()', 'trg_'||_tbl||'_sync_event', _tbl);
    exception when undefined_table then
      null;
    end;
  end loop;
end $$;

create index if not exists expenses_user_updated_at_idx on public.expenses (user_id, updated_at desc);
create index if not exists incomes_user_updated_at_idx on public.incomes (user_id, updated_at desc);
create index if not exists subscriptions_user_updated_at_idx on public.subscriptions (user_id, updated_at desc);
create index if not exists health_metrics_user_updated_at_idx on public.health_metrics (user_id, updated_at desc);
create index if not exists hydration_logs_user_updated_at_idx on public.hydration_logs (user_id, updated_at desc);
create index if not exists habit_checkins_user_updated_at_idx on public.habit_checkins (user_id, updated_at desc);
