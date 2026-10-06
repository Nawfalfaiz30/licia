-- Canonical migration 0015 — Distributed rate limiting + finance aggregation

create table if not exists public.licia_rate_limit_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_key text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, bucket_key, window_start)
);

alter table public.licia_rate_limit_buckets enable row level security;

create index if not exists licia_rate_limit_buckets_updated_idx
  on public.licia_rate_limit_buckets(updated_at);

create or replace function public.licia_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  bucket text := left(trim(coalesce(p_bucket_key, '')), 100);
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

  started_at := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into public.licia_rate_limit_buckets(user_id, bucket_key, window_start, hit_count)
  values(uid, bucket, started_at, 1)
  on conflict (user_id, bucket_key, window_start)
  do update set
    hit_count = public.licia_rate_limit_buckets.hit_count + 1,
    updated_at = now()
  returning hit_count into hits;

  delete from public.licia_rate_limit_buckets
   where user_id = uid
     and updated_at < now() - interval '1 day';

  retry_after := greatest(
    1,
    ceil(extract(epoch from ((started_at + make_interval(secs => window_seconds)) - clock_timestamp())))::integer
  );

  return jsonb_build_object(
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
set search_path = public
language sql
stable
as $$
  select coalesce(sum(total_tokens), 0)::bigint
    from public.ai_usage_events
   where user_id = auth.uid()
     and created_at >= p_since;
$$;

revoke all on function public.licia_get_ai_usage_total(timestamptz) from public, anon;
grant execute on function public.licia_get_ai_usage_total(timestamptz) to authenticated;

create or replace function public.licia_get_finance_summary(
  p_range_months integer default 6,
  p_timezone text default 'Asia/Jakarta'
)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  range_months integer := greatest(1, least(coalesce(p_range_months, 6), 24));
  tz text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Jakarta');
  now_local timestamp;
  month_start_local timestamp;
  month_start timestamptz;
  month_income numeric := 0;
  month_expense numeric := 0;
  categories jsonb := '[]'::jsonb;
  monthly jsonb := '[]'::jsonb;
  budgets jsonb := '[]'::jsonb;
  accounts jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  begin
    now_local := timezone(tz, now());
  exception when others then
    tz := 'Asia/Jakarta';
    now_local := timezone(tz, now());
  end;

  month_start_local := date_trunc('month', now_local);
  month_start := month_start_local at time zone tz;

  select coalesce(sum(i.amount), 0)
    into month_income
    from public.incomes i
   where i.user_id = uid and i.occurred_at >= month_start;

  select coalesce(sum(e.amount), 0)
    into month_expense
    from public.expenses e
   where e.user_id = uid and e.occurred_at >= month_start;

  select coalesce(jsonb_agg(
    jsonb_build_object('category', x.category, 'amount', x.amount)
    order by x.amount desc
  ), '[]'::jsonb)
    into categories
    from (
      select coalesce(nullif(trim(e.category), ''), 'Lainnya') as category, sum(e.amount) as amount
        from public.expenses e
       where e.user_id = uid and e.occurred_at >= month_start
       group by coalesce(nullif(trim(e.category), ''), 'Lainnya')
    ) x;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'k', to_char(x.month_start, 'YYYY-MM'),
      'label', to_char(x.month_start, 'Mon'),
      'income', x.income,
      'expense', x.expense,
      'net', x.income - x.expense
    ) order by x.month_start
  ), '[]'::jsonb)
    into monthly
    from (
      select g.month_start,
        coalesce((select sum(i.amount) from public.incomes i where i.user_id = uid and i.occurred_at >= (g.month_start at time zone tz) and i.occurred_at < ((g.month_start + interval '1 month') at time zone tz)), 0) as income,
        coalesce((select sum(e.amount) from public.expenses e where e.user_id = uid and e.occurred_at >= (g.month_start at time zone tz) and e.occurred_at < ((g.month_start + interval '1 month') at time zone tz)), 0) as expense
      from generate_series(
        month_start_local - make_interval(months => range_months - 1),
        month_start_local,
        interval '1 month'
      ) g(month_start)
    ) x;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'spent', coalesce((
        select sum(e.amount)
        from public.expenses e
        where e.user_id = uid
          and e.category = b.category
          and e.occurred_at >= case
            when b.period = 'weekly' then ((now_local::date - 6)::timestamp at time zone tz)
            else (month_start_local at time zone tz)
          end
      ), 0)
    )
  ), '[]'::jsonb)
    into budgets
    from public.budgets b
   where b.user_id = uid;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'current_balance', coalesce(a.current_balance, a.starting_balance, 0),
      'account_type', a.account_type,
      'is_default', a.is_default
    ) order by a.is_default desc, a.created_at
  ), '[]'::jsonb)
    into accounts
    from public.accounts a
   where a.user_id = uid;

  return jsonb_build_object(
    'month_income', month_income,
    'month_expense', month_expense,
    'month_net', month_income - month_expense,
    'categories', categories,
    'monthly', monthly,
    'budgets', budgets,
    'accounts', accounts,
    'total_balance', coalesce((
      select sum(coalesce(a.current_balance, a.starting_balance, 0))
      from public.accounts a
      where a.user_id = uid
    ), 0),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.licia_get_finance_summary(integer, text) from public, anon;
grant execute on function public.licia_get_finance_summary(integer, text) to authenticated;
