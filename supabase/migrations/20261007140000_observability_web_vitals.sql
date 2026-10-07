alter table if exists public.ai_function_call_logs
  add column if not exists request_id text;

create index if not exists ai_function_call_logs_request_idx
  on public.ai_function_call_logs(request_id);

create table if not exists public.web_vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  metric text not null check (metric in ('LCP','INP','CLS')),
  value numeric not null,
  pathname text not null default '/',
  device text,
  created_at timestamptz not null default now()
);

create index if not exists web_vitals_created_idx on public.web_vitals(created_at desc);
create index if not exists web_vitals_user_created_idx on public.web_vitals(user_id, created_at desc);

alter table public.web_vitals enable row level security;
drop policy if exists "web_vitals_insert_own" on public.web_vitals;
create policy "web_vitals_insert_own"
  on public.web_vitals for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "web_vitals_select_own" on public.web_vitals;
create policy "web_vitals_select_own"
  on public.web_vitals for select
  using (user_id = (select auth.uid()));
