-- Canonical migration: supabase/migrations/0005_sync_robustness_v34.sql
-- Source lineage: supabase/schema_v34_sync_robustness.sql

-- ============================================================
-- LICIA V34 - SYNC ROBUSTNESS / SMART CONFLICT MERGE
-- Jalankan setelah schema_v33_life_os.sql
-- ============================================================

-- Keep a compact field-level change set for every sync update. This lets the
-- server decide whether a client patch touches the same fields changed by a
-- newer server version instead of treating every version mismatch as unsafe.
alter table public.life_os_sync_events
  add column if not exists changed_fields text[] not null default '{}';

create index if not exists life_os_sync_events_user_entity_sequence_idx
  on public.life_os_sync_events (user_id, entity_type, entity_id, sequence desc);

create or replace function public.licia_changed_fields(
  old_row jsonb,
  new_row jsonb
)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(key order by key), '{}'::text[])
  from (
    select key
    from jsonb_object_keys(coalesce(new_row, '{}'::jsonb)) as keys(key)
    union
    select key
    from jsonb_object_keys(coalesce(old_row, '{}'::jsonb)) as keys(key)
  ) all_keys
  where key not in ('id','user_id','version','created_at','updated_at','deleted_at')
    and coalesce(old_row -> key, 'null'::jsonb) is distinct from coalesce(new_row -> key, 'null'::jsonb);
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
  event_operation text;
  event_payload jsonb;
  fields text[] := '{}'::text[];
begin
  if tg_op = 'DELETE' then
    entity := old.id;
    uid := old.user_id;
    event_operation := 'delete';
    event_payload := jsonb_build_object(
      'id', entity,
      'version', coalesce(old.version, 0),
      'deleted_at', now()
    );
  else
    entity := new.id;
    uid := new.user_id;
    event_operation := case when tg_op = 'INSERT' then 'create' else 'update' end;
    event_payload := to_jsonb(new);
    if tg_op = 'INSERT' then
      select coalesce(array_agg(key order by key), '{}'::text[])
      into fields
      from jsonb_object_keys(event_payload) as keys(key)
      where key not in ('id','user_id','version','created_at','updated_at','deleted_at');
    else
      fields := public.licia_changed_fields(to_jsonb(old), to_jsonb(new));
    end if;
  end if;

  insert into public.life_os_sync_events (
    user_id,
    entity_type,
    entity_id,
    operation,
    payload,
    changed_fields
  )
  values (
    uid,
    tg_table_name,
    entity,
    event_operation,
    event_payload,
    fields
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.licia_changed_fields(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.licia_write_sync_event() from public, anon, authenticated;

-- V33's auxiliary event writer receives the same field-level metadata.
create or replace function public.licia_write_v33_event()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  payload jsonb;
  fields text[] := '{}'::text[];
begin
  if tg_op = 'DELETE' then
    payload := jsonb_build_object('id', old.id, 'deleted_at', now(), 'version', coalesce(old.version, 0));
  else
    payload := to_jsonb(new);
    if tg_op = 'INSERT' then
      select coalesce(array_agg(key order by key), '{}'::text[])
      into fields
      from jsonb_object_keys(payload) as keys(key)
      where key not in ('id','user_id','version','created_at','updated_at','deleted_at');
    else
      fields := public.licia_changed_fields(to_jsonb(old), to_jsonb(new));
    end if;
  end if;

  insert into public.life_os_sync_events (
    user_id,
    entity_type,
    entity_id,
    operation,
    payload,
    changed_fields
  )
  values (
    coalesce(new.user_id, old.user_id),
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then 'create' when tg_op = 'DELETE' then 'delete' else 'update' end,
    payload,
    fields
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.licia_write_v33_event() from public, anon, authenticated;

-- Repair any events created before V34. Existing update events cannot always be
-- reconstructed exactly, so they intentionally keep an empty change set.
-- Smart merge will require a usable change history and otherwise fall back to
-- manual conflict resolution.
