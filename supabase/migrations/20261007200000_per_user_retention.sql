create or replace function public.licia_prune_operational_logs_for_user(
  p_user_id uuid,
  p_keep_days integer default 90
)
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
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_user_id is null then
    raise exception using errcode = '22004', message = 'USER_REQUIRED';
  end if;

  foreach tab in array array[
    'ai_function_call_logs','ai_usage_events','notification_events','life_os_events',
    'ai_chat_messages','ai_proactive_events'
  ] loop
    if to_regclass('public.' || tab) is not null then
      execute format('delete from public.%I where created_at < $1 and user_id = $2', tab)
        using cutoff, p_user_id;
      get diagnostics deleted_count = row_count;
      total_deleted := total_deleted + deleted_count;
    end if;
  end loop;

  return jsonb_build_object(
    'user_id', p_user_id,
    'cutoff', cutoff,
    'keep_days', keep_days,
    'deleted_rows', total_deleted
  );
end
$$;

revoke all on function public.licia_prune_operational_logs_for_user(uuid, integer) from public, anon, authenticated;
grant execute on function public.licia_prune_operational_logs_for_user(uuid, integer) to service_role;
