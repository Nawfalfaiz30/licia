-- Keep security-definer RPCs safe from objects shadowed through search_path.
create or replace function public.licia_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  bucket text := pg_catalog.left(pg_catalog.btrim(coalesce(p_bucket_key, '')), 100);
  window_seconds integer := greatest(1, least(coalesce(p_window_seconds, 60), 86400));
  max_hits integer := greatest(1, least(coalesce(p_limit, 30), 10000));
  started_at timestamptz;
  hits integer;
  retry_after integer;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;
  if bucket = '' then
    raise exception using errcode = '22023', message = 'Rate limit bucket tidak valid.';
  end if;

  started_at := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into public.licia_rate_limit_buckets(user_id, bucket_key, window_start, hit_count)
  values(uid, bucket, started_at, 1)
  on conflict (user_id, bucket_key, window_start)
  do update set
    hit_count = public.licia_rate_limit_buckets.hit_count + 1,
    updated_at = pg_catalog.now()
  returning hit_count into hits;

  delete from public.licia_rate_limit_buckets
   where user_id = uid
     and updated_at < pg_catalog.now() - interval '1 day';

  retry_after := greatest(
    1,
    pg_catalog.ceil(
      extract(epoch from ((started_at + pg_catalog.make_interval(secs => window_seconds)) - pg_catalog.clock_timestamp()))
    )::integer
  );

  return pg_catalog.jsonb_build_object(
    'allowed', hits <= max_hits,
    'limit', max_hits,
    'count', hits,
    'retry_after_seconds', retry_after
  );
end;
$$;

revoke all on function public.licia_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.licia_rate_limit(text, integer, integer) to authenticated;

create or replace function public.licia_get_ai_usage_total(p_since timestamptz)
returns bigint
security definer
set search_path = ''
language sql
stable
as $$
  select coalesce(pg_catalog.sum(events.total_tokens), 0)::bigint
    from public.ai_usage_events as events
   where events.user_id = auth.uid()
     and events.created_at >= p_since;
$$;

revoke all on function public.licia_get_ai_usage_total(timestamptz) from public, anon;
grant execute on function public.licia_get_ai_usage_total(timestamptz) to authenticated;

create table if not exists public.licia_external_rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, window_start)
);

alter table public.licia_external_rate_limit_buckets enable row level security;
revoke all on table public.licia_external_rate_limit_buckets from public, anon, authenticated;

create index if not exists licia_external_rate_limit_buckets_updated_idx
  on public.licia_external_rate_limit_buckets(updated_at);

create or replace function public.licia_rate_limit_external(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
  bucket text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_bucket_key, '')));
  window_seconds integer := greatest(1, least(coalesce(p_window_seconds, 60), 86400));
  max_hits integer := greatest(1, least(coalesce(p_limit, 30), 10000));
  started_at timestamptz;
  hits integer;
  retry_after integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if bucket !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Rate limit bucket tidak valid.';
  end if;

  started_at := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into public.licia_external_rate_limit_buckets(bucket_key, window_start, hit_count)
  values(bucket, started_at, 1)
  on conflict (bucket_key, window_start)
  do update set
    hit_count = public.licia_external_rate_limit_buckets.hit_count + 1,
    updated_at = pg_catalog.now()
  returning hit_count into hits;

  delete from public.licia_external_rate_limit_buckets
   where updated_at < pg_catalog.now() - interval '1 day';

  retry_after := greatest(
    1,
    pg_catalog.ceil(
      extract(epoch from ((started_at + pg_catalog.make_interval(secs => window_seconds)) - pg_catalog.clock_timestamp()))
    )::integer
  );

  return pg_catalog.jsonb_build_object(
    'allowed', hits <= max_hits,
    'limit', max_hits,
    'count', hits,
    'retry_after_seconds', retry_after
  );
end;
$$;

revoke all on function public.licia_rate_limit_external(text, integer, integer) from public, anon, authenticated;
grant execute on function public.licia_rate_limit_external(text, integer, integer) to service_role;
