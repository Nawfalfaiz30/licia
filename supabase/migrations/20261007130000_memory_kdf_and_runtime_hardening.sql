-- Curated memory metadata. Existing rows remain valid and can be indexed lazily.
do $$
begin
  if to_regclass('public.user_memories') is not null then
    execute 'alter table public.user_memories add column if not exists confidence real default 0.7 check (confidence >= 0 and confidence <= 1)';
    execute 'alter table public.user_memories add column if not exists last_used_at timestamptz';
    execute 'alter table public.user_memories add column if not exists source_ref jsonb';
    execute 'alter table public.user_memories add column if not exists superseded_by uuid';
    execute 'create index if not exists user_memories_user_last_used_idx on public.user_memories(user_id, last_used_at desc nulls last)';
    execute 'create index if not exists user_memories_user_confidence_idx on public.user_memories(user_id, confidence desc)';
  end if;
end
$$;

-- A maintenance call can be made by the service role, while normal users can only
-- prune their own records.
create or replace function public.licia_prune_operational_logs(p_keep_days integer default 90)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  keep_days integer := greatest(7, least(coalesce(p_keep_days,90),3650));
  cutoff timestamptz := now() - make_interval(days => keep_days);
  deleted_count bigint := 0;
  total_deleted bigint := 0;
  tab text;
  service_mode boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if auth.uid() is null and not service_mode then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  foreach tab in array array[
    'ai_function_call_logs','ai_usage_events','notification_events','life_os_events','ai_chat_messages'
  ] loop
    if to_regclass('public.' || tab) is not null then
      if service_mode then
        execute format('delete from public.%I where created_at < $1', tab) using cutoff;
      else
        execute format('delete from public.%I where created_at < $1 and user_id = $2', tab)
          using cutoff, auth.uid();
      end if;
      get diagnostics deleted_count = row_count;
      total_deleted := total_deleted + deleted_count;
    end if;
  end loop;

  return jsonb_build_object(
    'cutoff', cutoff,
    'keep_days', keep_days,
    'deleted_rows', total_deleted,
    'service_mode', service_mode
  );
end
$$;

revoke all on function public.licia_prune_operational_logs(integer) from public, anon;
grant execute on function public.licia_prune_operational_logs(integer) to authenticated, service_role;
