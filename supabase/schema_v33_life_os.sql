-- ============================================================
-- LICIA V33 - LIFE GRAPH / SNAPSHOTS / PERFORMANCE FOUNDATION
-- Jalankan setelah schema_v32_sync_experience.sql
-- ============================================================

create table if not exists public.life_os_entity_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  relation text not null,
  target_type text not null,
  target_id uuid not null,
  confidence numeric(5,4),
  metadata jsonb not null default '{}'::jsonb,
  created_by text not null default 'user' check (created_by in ('user','ai','system','automation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, relation, target_type, target_id)
);

create index if not exists life_os_entity_links_user_source_idx
  on public.life_os_entity_links (user_id, source_type, source_id);
create index if not exists life_os_entity_links_user_target_idx
  on public.life_os_entity_links (user_id, target_type, target_id);
create index if not exists life_os_entity_links_user_created_idx
  on public.life_os_entity_links (user_id, created_at desc);

alter table public.life_os_entity_links enable row level security;
drop policy if exists life_os_entity_links_select on public.life_os_entity_links;
drop policy if exists life_os_entity_links_insert on public.life_os_entity_links;
drop policy if exists life_os_entity_links_update on public.life_os_entity_links;
drop policy if exists life_os_entity_links_delete on public.life_os_entity_links;
create policy life_os_entity_links_select on public.life_os_entity_links for select using (user_id = auth.uid());
create policy life_os_entity_links_insert on public.life_os_entity_links for insert with check (user_id = auth.uid());
create policy life_os_entity_links_update on public.life_os_entity_links for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy life_os_entity_links_delete on public.life_os_entity_links for delete using (user_id = auth.uid());

create table if not exists public.life_os_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  timezone text not null default 'Asia/Jakarta',
  data jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  source_version text not null default 'v33',
  unique (user_id, snapshot_date)
);

create index if not exists life_os_daily_snapshots_user_date_idx
  on public.life_os_daily_snapshots (user_id, snapshot_date desc);

alter table public.life_os_daily_snapshots enable row level security;
drop policy if exists life_os_daily_snapshots_select on public.life_os_daily_snapshots;
drop policy if exists life_os_daily_snapshots_insert on public.life_os_daily_snapshots;
drop policy if exists life_os_daily_snapshots_update on public.life_os_daily_snapshots;
create policy life_os_daily_snapshots_select on public.life_os_daily_snapshots for select using (user_id = auth.uid());
create policy life_os_daily_snapshots_insert on public.life_os_daily_snapshots for insert with check (user_id = auth.uid());
create policy life_os_daily_snapshots_update on public.life_os_daily_snapshots for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists tasks_user_status_due_idx
  on public.tasks (user_id, status, due_at);
create index if not exists reminders_user_status_time_idx
  on public.reminders (user_id, status, enabled, remind_at);
create index if not exists goals_user_status_target_idx
  on public.goals (user_id, status, target_date);
create index if not exists projects_user_status_target_idx
  on public.projects (user_id, status, target_date);
create index if not exists inbox_user_status_created_idx
  on public.smart_inbox_items (user_id, status, created_at desc);


-- Extend Sync Core to additional mutable Life OS domains used by V33.
do $$
declare
  _tbl text;
begin
  foreach _tbl in array array[
    'budgets','accounts','automations','vault_items'
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

create index if not exists budgets_user_updated_at_idx on public.budgets (user_id, updated_at desc);
create index if not exists accounts_user_updated_at_idx on public.accounts (user_id, updated_at desc);
create index if not exists automations_user_enabled_idx on public.automations (user_id, enabled, updated_at desc);
create index if not exists vault_items_user_updated_at_idx on public.vault_items (user_id, updated_at desc);

-- Keep link/snapshot writes visible to the Life OS event stream.
create or replace function public.licia_write_v33_event()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.life_os_sync_events (user_id, entity_type, entity_id, operation, payload)
  values (
    coalesce(new.user_id, old.user_id),
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then 'create' when tg_op = 'DELETE' then 'delete' else 'update' end,
    case when tg_op = 'DELETE' then jsonb_build_object('id', old.id, 'deleted_at', now()) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.licia_write_v33_event() from public, anon, authenticated;

drop trigger if exists trg_entity_links_sync_event on public.life_os_entity_links;
create trigger trg_entity_links_sync_event
after insert or update or delete on public.life_os_entity_links
for each row execute function public.licia_write_v33_event();

drop trigger if exists trg_daily_snapshots_sync_event on public.life_os_daily_snapshots;
create trigger trg_daily_snapshots_sync_event
after insert or update or delete on public.life_os_daily_snapshots
for each row execute function public.licia_write_v33_event();

-- Realtime invalidation for the new Life OS graph.
do $$
begin
  begin
    alter publication supabase_realtime add table public.life_os_entity_links;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when insufficient_privilege then null;
  end;
end $$;
