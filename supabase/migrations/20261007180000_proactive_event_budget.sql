create table if not exists public.ai_proactive_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null unique,
  suggestion_id text not null,
  title text not null default '',
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_proactive_events_user_created_idx
  on public.ai_proactive_events(user_id, created_at desc);

alter table public.ai_proactive_events enable row level security;
drop policy if exists "ai_proactive_events_own" on public.ai_proactive_events;
create policy "ai_proactive_events_own"
  on public.ai_proactive_events for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
