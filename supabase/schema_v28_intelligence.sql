-- Licia V28 — Notification, Push, Reminder & AI intelligence layer
-- Jalankan setelah supabase/schema_all.sql. Semua objek idempotent.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_all_own" on public.push_subscriptions;
create policy "push_subscriptions_all_own" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_push_subscriptions_user_enabled on public.push_subscriptions(user_id, enabled, updated_at desc);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  remind_at timestamptz not null,
  href text not null default '/',
  timezone text not null default 'Asia/Jakarta',
  target_type text not null default 'custom' check (target_type in ('custom','schedule','task','goal','project','subscription','habit')),
  target_id uuid,
  offset_minutes integer,
  enabled boolean not null default true,
  status text not null default 'pending' check (status in ('pending','processing','sent','cancelled','waiting_for_device','failed')),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reminders enable row level security;
drop policy if exists "reminders_all_own" on public.reminders;
create policy "reminders_all_own" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_reminders_user_pending on public.reminders(user_id, enabled, status, remind_at);
create index if not exists idx_reminders_target on public.reminders(user_id, target_type, target_id);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null unique,
  title text not null,
  body text,
  href text default '/',
  tone text not null default 'accent',
  source_type text not null default 'system',
  source_id uuid,
  scheduled_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notification_events enable row level security;
drop policy if exists "notification_events_all_own" on public.notification_events;
create policy "notification_events_all_own" on public.notification_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_notification_events_user_recent on public.notification_events(user_id, created_at desc);
create index if not exists idx_notification_events_user_unread on public.notification_events(user_id, read_at, created_at desc);

alter table public.users add column if not exists preferences jsonb not null default '{}'::jsonb;
comment on table public.reminders is 'One-shot reminders used by Licia notification/push engine. Agenda reminders are synchronized from schedule_blocks by target_id + offset_minutes.';
comment on table public.push_subscriptions is 'Browser/PWA Web Push subscriptions. Endpoint is sensitive and only accessible server-side for dispatch.';
comment on table public.notification_events is 'Persistent notification center events; reminders are converted to events when dispatch time arrives.';
