-- ============================================================
-- LICIA V31 - SYNC CORE / MULTI-DEVICE / IDEMPOTENCY
-- ============================================================

create table if not exists public.life_os_sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  platform text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create table if not exists public.life_os_sync_events (
  sequence bigint generated always as identity primary key,
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  operation text not null check (operation in ('create','update','delete')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id)
);

create index if not exists life_os_sync_events_user_sequence_idx
  on public.life_os_sync_events (user_id, sequence);
create index if not exists life_os_sync_events_user_created_idx
  on public.life_os_sync_events (user_id, created_at desc);

create table if not exists public.life_os_sync_mutations (
  mutation_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  entity_type text not null,
  entity_id uuid,
  operation text not null check (operation in ('create','update','delete')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'processing' check (status in ('processing','done','failed')),
  response jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists life_os_sync_mutations_user_created_idx
  on public.life_os_sync_mutations (user_id, created_at desc);

alter table public.life_os_sync_devices enable row level security;
alter table public.life_os_sync_events enable row level security;
alter table public.life_os_sync_mutations enable row level security;

drop policy if exists life_os_sync_devices_select on public.life_os_sync_devices;
create policy life_os_sync_devices_select on public.life_os_sync_devices
  for select using (user_id = auth.uid());

drop policy if exists life_os_sync_devices_insert on public.life_os_sync_devices;
create policy life_os_sync_devices_insert on public.life_os_sync_devices
  for insert with check (user_id = auth.uid());

drop policy if exists life_os_sync_devices_update on public.life_os_sync_devices;
create policy life_os_sync_devices_update on public.life_os_sync_devices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists life_os_sync_events_select on public.life_os_sync_events;
create policy life_os_sync_events_select on public.life_os_sync_events
  for select using (user_id = auth.uid());

drop policy if exists life_os_sync_mutations_select on public.life_os_sync_mutations;
create policy life_os_sync_mutations_select on public.life_os_sync_mutations
  for select using (user_id = auth.uid());

-- Legacy clients still need to be able to claim their own mutation row.
-- V32 routes use the server client for authoritative status changes.
drop policy if exists life_os_sync_mutations_insert on public.life_os_sync_mutations;
create policy life_os_sync_mutations_insert on public.life_os_sync_mutations
  for insert with check (user_id = auth.uid());

drop policy if exists life_os_sync_mutations_update on public.life_os_sync_mutations;
create policy life_os_sync_mutations_update on public.life_os_sync_mutations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Versioning: one monotonic row-local version for conflict detection.
do $$
declare
  _tbl text;
begin
  foreach _tbl in array array['tasks','schedule_blocks','projects','goals','brain_dump_notes','smart_inbox_items','reminders','user_memories'] loop
    begin
      execute format('alter table public.%I add column if not exists version integer not null default 1', _tbl);
    exception when undefined_table then
      null;
    end;
  end loop;
end $$;

alter table public.schedule_blocks add column if not exists updated_at timestamptz not null default now();

create or replace function public.licia_bump_version()
returns trigger
language plpgsql
as $$
begin
  new.version := greatest(coalesce(old.version, 0) + 1, 1);
  if to_jsonb(new) ? 'updated_at' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.licia_write_sync_event()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  entity uuid;
  uid uuid;
begin
  if tg_op = 'DELETE' then
    entity := old.id;
    uid := old.user_id;
    insert into public.life_os_sync_events (user_id, entity_type, entity_id, operation, payload)
    values (uid, tg_table_name, entity, 'delete', jsonb_build_object('id', entity, 'version', coalesce(old.version, 0), 'deleted_at', now()));
    return old;
  end if;

  entity := new.id;
  uid := new.user_id;
  insert into public.life_os_sync_events (user_id, entity_type, entity_id, operation, payload)
  values (uid, tg_table_name, entity, case when tg_op='INSERT' then 'create' else 'update' end, to_jsonb(new));
  return new;
end;
$$;

revoke all on function public.licia_write_sync_event() from public, anon, authenticated;
revoke all on function public.licia_bump_version() from public, anon, authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['tasks','schedule_blocks','projects','goals','brain_dump_notes','smart_inbox_items','reminders','user_memories'] loop
    begin
      execute format('drop trigger if exists %I on public.%I', 'trg_'||tbl||'_version', tbl);
      execute format('create trigger %I before update on public.%I for each row execute function public.licia_bump_version()', 'trg_'||tbl||'_version', tbl);
      execute format('drop trigger if exists %I on public.%I', 'trg_'||tbl||'_sync_event', tbl);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.licia_write_sync_event()', 'trg_'||tbl||'_sync_event', tbl);
    exception when undefined_table then
      null;
    end;
  end loop;
end $$;

-- Realtime delivery for low-latency cross-device invalidation.
do $$
begin
  if to_regclass('public.life_os_sync_events') is null then
    raise notice 'life_os_sync_events belum tersedia, Realtime dilewati.';
    return;
  end if;

  begin
    alter publication supabase_realtime add table public.life_os_sync_events;
    raise notice 'life_os_sync_events berhasil ditambahkan ke supabase_realtime.';
  exception
    when duplicate_object then
      raise notice 'life_os_sync_events sudah terdaftar di supabase_realtime.';
    when undefined_object then
      raise notice 'Publication supabase_realtime tidak tersedia.';
    when insufficient_privilege then
      raise notice 'Tidak memiliki privilege untuk mengubah publication supabase_realtime.';
    when others then
      raise warning 'Gagal menambahkan life_os_sync_events ke Realtime: %', SQLERRM;
  end;
end $$;
