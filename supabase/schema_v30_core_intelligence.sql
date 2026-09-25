-- Licia V30 core intelligence + reminder reliability migration.
-- Safe to run after schema_all.sql / V28/V29 migrations.

create table if not exists public.life_os_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.life_os_events enable row level security;
drop policy if exists "life_os_events_all_own" on public.life_os_events;
create policy "life_os_events_all_own" on public.life_os_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_life_os_events_user_created on public.life_os_events(user_id, created_at desc);
create index if not exists idx_life_os_events_user_type on public.life_os_events(user_id, event_type, created_at desc);


create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  endpoint text not null default 'chat',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ai_usage_events enable row level security;
drop policy if exists "ai_usage_events_all_own" on public.ai_usage_events;
create policy "ai_usage_events_all_own" on public.ai_usage_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_ai_usage_events_user_created on public.ai_usage_events(user_id, created_at desc);

create table if not exists public.system_health_heartbeats (
  component text primary key,
  status text not null default 'ok' check (status in ('ok','degraded','error')),
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.system_health_heartbeats enable row level security;
-- No client policy by design. Only service-role/admin access is allowed.

alter table public.reminders add column if not exists delivery_attempts integer not null default 0;
alter table public.reminders add column if not exists last_error text;
alter table public.notification_events add column if not exists delivery_attempts integer not null default 0;
alter table public.notification_events add column if not exists last_delivery_error text;

-- Remove duplicate active target-bound reminders before enforcing one active reminder per target.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, target_type, target_id, offset_minutes
           order by created_at desc, id desc
         ) as rn
  from public.reminders
  where target_id is not null
    and enabled = true
    and status in ('pending','waiting_for_device','failed','processing')
)
update public.reminders r
set enabled = false, status = 'cancelled', updated_at = now(), last_error = 'V30 duplicate cleanup'
where r.id in (select id from ranked where rn > 1);

create unique index if not exists uniq_reminders_one_active_bound_target_offset
  on public.reminders(user_id, target_type, target_id, offset_minutes)
  where target_id is not null
    and offset_minutes is not null
    and enabled = true
    and status in ('pending','waiting_for_device','failed','processing');

-- Database-level safety: deleting a task/schedule must never leave an active reminder behind.
create or replace function public.licia_cancel_task_reminders_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reminders
  set enabled = false,
      status = 'cancelled',
      updated_at = now(),
      last_error = 'Source task deleted'
  where user_id = old.user_id
    and target_type = 'task'
    and target_id = old.id
    and status in ('pending','waiting_for_device','failed','processing');
  return old;
end;
$$;

create or replace function public.licia_cancel_schedule_reminders_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reminders
  set enabled = false,
      status = 'cancelled',
      updated_at = now(),
      last_error = 'Source schedule deleted'
  where user_id = old.user_id
    and target_type = 'schedule'
    and target_id = old.id
    and status in ('pending','waiting_for_device','failed','processing');
  return old;
end;
$$;

drop trigger if exists trg_licia_task_delete_cancel_reminders on public.tasks;
create trigger trg_licia_task_delete_cancel_reminders
after delete on public.tasks
for each row execute function public.licia_cancel_task_reminders_on_delete();

drop trigger if exists trg_licia_schedule_delete_cancel_reminders on public.schedule_blocks;
create trigger trg_licia_schedule_delete_cancel_reminders
after delete on public.schedule_blocks
for each row execute function public.licia_cancel_schedule_reminders_on_delete();

create or replace function public.licia_cancel_completed_task_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'done' and old.status is distinct from new.status then
    update public.reminders
    set enabled = false,
        status = 'cancelled',
        updated_at = now(),
        last_error = 'Task completed'
    where user_id = new.user_id
      and target_type = 'task'
      and target_id = new.id
      and status in ('pending','waiting_for_device','failed','processing');
  elsif new.due_at is null and old.due_at is distinct from new.due_at then
    update public.reminders
    set enabled = false,
        status = 'cancelled',
        updated_at = now(),
        last_error = 'Task deadline removed'
    where user_id = new.user_id
      and target_type = 'task'
      and target_id = new.id
      and status in ('pending','waiting_for_device','failed','processing');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_licia_task_state_cancel_reminders on public.tasks;
create trigger trg_licia_task_state_cancel_reminders
after update of status, due_at on public.tasks
for each row execute function public.licia_cancel_completed_task_reminder();

comment on table public.life_os_events is 'V30 durable domain event stream for cross-module intelligence, diagnostics, and activity.';
comment on table public.system_health_heartbeats is 'V30 server-side component heartbeats. Service-role only by design.';
