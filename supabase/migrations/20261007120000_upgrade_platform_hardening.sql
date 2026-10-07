-- Licia platform hardening and intelligence upgrade.
-- Safe to apply after the canonical migration chain 0001..0015.

create extension if not exists vector;

create table if not exists public.ai_request_traces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  conversation_id text,
  prompt_version text,
  model text,
  tool_model text,
  tools jsonb not null default '[]'::jsonb,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer,
  status text not null default 'started' check (status in ('started','completed','error','cancelled')),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_request_traces_user_created_idx
  on public.ai_request_traces(user_id, created_at desc);
create index if not exists ai_request_traces_request_idx
  on public.ai_request_traces(request_id);

alter table public.ai_request_traces enable row level security;
drop policy if exists "ai_request_traces_select_own" on public.ai_request_traces;
create policy "ai_request_traces_select_own"
  on public.ai_request_traces for select
  using (user_id = (select auth.uid()));

drop policy if exists "ai_request_traces_insert_own" on public.ai_request_traces;
create policy "ai_request_traces_insert_own"
  on public.ai_request_traces for insert
  with check (user_id = (select auth.uid()));

create table if not exists public.ai_privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  exclude_finance boolean not null default false,
  exclude_health boolean not null default false,
  private_mode boolean not null default false,
  log_retention_days integer not null default 90 check (log_retention_days between 7 and 3650),
  updated_at timestamptz not null default now()
);

alter table public.ai_privacy_preferences enable row level security;
drop policy if exists "ai_privacy_preferences_own" on public.ai_privacy_preferences;
create policy "ai_privacy_preferences_own"
  on public.ai_privacy_preferences for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.ai_proactive_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  max_suggestions_per_day integer not null default 3 check (max_suggestions_per_day between 0 and 24),
  quiet_start text,
  quiet_end text,
  allow_finance boolean not null default true,
  allow_health boolean not null default true,
  allow_schedule boolean not null default true,
  allow_tasks boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.ai_proactive_preferences enable row level security;
drop policy if exists "ai_proactive_preferences_own" on public.ai_proactive_preferences;
create policy "ai_proactive_preferences_own"
  on public.ai_proactive_preferences for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.ai_knowledge_index (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  title text not null default '',
  content text not null default '',
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))
  ) stored,
  embedding vector(1536),
  source_hash text,
  updated_at timestamptz not null default now(),
  unique(user_id, source_type, source_id)
);

create index if not exists ai_knowledge_index_user_type_idx
  on public.ai_knowledge_index(user_id, source_type);
create index if not exists ai_knowledge_index_fts_idx
  on public.ai_knowledge_index using gin(search_vector);
create index if not exists ai_knowledge_index_hash_idx
  on public.ai_knowledge_index(user_id, source_hash);

do $$
begin
  if not exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and indexname = 'ai_knowledge_index_embedding_hnsw_idx'
  ) then
    execute 'create index ai_knowledge_index_embedding_hnsw_idx on public.ai_knowledge_index using hnsw (embedding vector_cosine_ops)';
  end if;
end
$$;

alter table public.ai_knowledge_index enable row level security;
drop policy if exists "ai_knowledge_index_select_own" on public.ai_knowledge_index;
create policy "ai_knowledge_index_select_own"
  on public.ai_knowledge_index for select
  using (user_id = (select auth.uid()));

drop policy if exists "ai_knowledge_index_write_own" on public.ai_knowledge_index;
create policy "ai_knowledge_index_write_own"
  on public.ai_knowledge_index for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.licia_hybrid_search(
  p_query text,
  p_embedding vector(1536),
  p_limit integer default 20
)
returns table (
  source_type text,
  source_id uuid,
  title text,
  content text,
  score double precision
)
security invoker
set search_path = public
language sql
stable
as $$
  with fts as (
    select
      k.id,
      k.source_type,
      k.source_id,
      k.title,
      k.content,
      row_number() over (
        order by ts_rank_cd(
          k.search_vector,
          websearch_to_tsquery('simple', nullif(trim(coalesce(p_query,'')), ''))
        ) desc
      ) as rnk
    from public.ai_knowledge_index k
    where k.user_id = (select auth.uid())
      and nullif(trim(coalesce(p_query,'')), '') is not null
      and k.search_vector @@ websearch_to_tsquery('simple', trim(p_query))
    order by ts_rank_cd(
      k.search_vector,
      websearch_to_tsquery('simple', trim(p_query))
    ) desc
    limit 100
  ),
  vec as (
    select
      k.id,
      k.source_type,
      k.source_id,
      k.title,
      k.content,
      row_number() over (order by k.embedding <=> p_embedding) as rnk
    from public.ai_knowledge_index k
    where k.user_id = (select auth.uid())
      and p_embedding is not null
      and k.embedding is not null
    order by k.embedding <=> p_embedding
    limit 100
  ),
  combined as (
    select id, source_type, source_id, title, content, (1.0 / (60.0 + rnk::double precision)) as score from fts
    union all
    select id, source_type, source_id, title, content, (1.0 / (60.0 + rnk::double precision)) as score from vec
  )
  select
    c.source_type,
    c.source_id,
    max(c.title) as title,
    max(c.content) as content,
    sum(c.score) as score
  from combined c
  group by c.id, c.source_type, c.source_id
  order by score desc
  limit greatest(1, least(coalesce(p_limit,20), 100));
$$;

revoke all on function public.licia_hybrid_search(text, vector, integer) from public, anon;
grant execute on function public.licia_hybrid_search(text, vector, integer) to authenticated;

do $$
declare
  tab text;
begin
  foreach tab in array array[
    'tasks','projects','goals','schedule_blocks','expenses','incomes','reminders',
    'notification_events','ai_function_call_logs','ai_usage_events','life_os_events','ai_chat_messages'
  ] loop
    if to_regclass('public.' || tab) is not null then
      execute format('create index if not exists %I on public.%I(user_id, updated_at desc)', tab || '_user_updated_idx', tab);
    end if;
  end loop;
end
$$;

create table if not exists public.ai_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  query text not null,
  filters jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_saved_searches enable row level security;
drop policy if exists "ai_saved_searches_own" on public.ai_saved_searches;
create policy "ai_saved_searches_own" on public.ai_saved_searches for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.life_os_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  file_name text,
  rows_total integer not null default 0,
  rows_processed integer not null default 0,
  rows_created integer not null default 0,
  rows_skipped integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.life_os_import_jobs enable row level security;
drop policy if exists "life_os_import_jobs_own" on public.life_os_import_jobs;
create policy "life_os_import_jobs_own" on public.life_os_import_jobs for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.automation_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  automation_id uuid,
  url text not null,
  secret_hash text,
  events text[] not null default '{}',
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_webhooks_user_idx on public.automation_webhooks(user_id, enabled);
alter table public.automation_webhooks enable row level security;
drop policy if exists "automation_webhooks_own" on public.automation_webhooks;
create policy "automation_webhooks_own" on public.automation_webhooks for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.scheduled_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  frequency text not null default 'weekly' check (frequency in ('weekly','monthly')),
  weekday integer,
  hour_local integer not null default 22 check (hour_local between 0 and 23),
  timezone text not null default 'Asia/Jakarta',
  destination text not null default 'supabase_storage' check (destination in ('supabase_storage','s3')),
  bucket text,
  object_prefix text default 'backups',
  retention_days integer not null default 90 check (retention_days between 7 and 3650),
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.scheduled_exports enable row level security;
drop policy if exists "scheduled_exports_own" on public.scheduled_exports;
create policy "scheduled_exports_own" on public.scheduled_exports for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

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
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  foreach tab in array array[
    'ai_function_call_logs','ai_usage_events','notification_events','life_os_events','ai_chat_messages'
  ] loop
    if to_regclass('public.' || tab) is not null then
      execute format('delete from public.%I where created_at < $1 and user_id = $2', tab)
        using cutoff, auth.uid();
      get diagnostics deleted_count = row_count;
      total_deleted := total_deleted + deleted_count;
    end if;
  end loop;

  return jsonb_build_object(
    'cutoff', cutoff,
    'keep_days', keep_days,
    'deleted_rows', total_deleted
  );
end
$$;

revoke all on function public.licia_prune_operational_logs(integer) from public, anon;
grant execute on function public.licia_prune_operational_logs(integer) to authenticated;

create or replace function public.licia_rls_report()
returns jsonb
security invoker
set search_path = public
language sql
stable
as $$
  select jsonb_build_object(
    'tables_without_rls',
    coalesce(jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename) order by schemaname, tablename), '[]'::jsonb)
  )
  from pg_tables
  where schemaname = 'public'
    and rowsecurity = false;
$$;

revoke all on function public.licia_rls_report() from public, anon;
grant execute on function public.licia_rls_report() to authenticated;
