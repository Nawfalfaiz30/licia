create table if not exists public.automation_webhook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  webhook_id uuid,
  event_type text not null default 'webhook',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.automation_webhook_events enable row level security;
drop policy if exists "automation_webhook_events_own" on public.automation_webhook_events;
create policy "automation_webhook_events_own" on public.automation_webhook_events for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create index if not exists automation_webhook_events_queue_idx
  on public.automation_webhook_events(status, created_at);
create index if not exists automation_webhook_events_user_idx
  on public.automation_webhook_events(user_id, created_at desc);
