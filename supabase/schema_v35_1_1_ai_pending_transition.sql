-- ============================================================
-- LICIA V35.1.1 - HARDEN ai_pending_actions STATUS TRANSITIONS
-- ============================================================
-- Fixes legacy database triggers that incorrectly reject the
-- valid transition: pending -> applied.
-- Safe to run multiple times.

create table if not exists public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_text text not null default '',
  timezone text not null default 'Asia/Jakarta',
  actions jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','applied','applied_with_errors','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  applied_at timestamptz,
  cancelled_at timestamptz
);

alter table public.ai_pending_actions
  add column if not exists completed_actions integer not null default 0,
  add column if not exists failed_actions integer not null default 0,
  add column if not exists error_summary text,
  add column if not exists execution_result jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ai_pending_actions enable row level security;

drop policy if exists "ai_pending_actions_all_own" on public.ai_pending_actions;
create policy "ai_pending_actions_all_own"
  on public.ai_pending_actions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Find and remove only legacy triggers that explicitly reject
-- a valid pending -> applied transition. Other application triggers
-- (for example updated_at bookkeeping) are preserved.
do $$
declare
  r record;
begin
  for r in
    select
      t.tgname,
      pg_get_functiondef(p.oid) as function_definition
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.ai_pending_actions'::regclass
      and not t.tgisinternal
  loop
    if lower(coalesce(r.function_definition, '')) like '%invalid ai_pending_actions status transition%' then
      execute format(
        'drop trigger if exists %I on public.ai_pending_actions',
        r.tgname
      );
    end if;
  end loop;
end $$;

create or replace function public.licia_validate_ai_pending_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not (
      old.status = new.status
      or (
        old.status = 'pending'
        and new.status in ('applied', 'applied_with_errors', 'cancelled', 'expired')
      )
    ) then
      raise exception
        'invalid ai_pending_actions status transition: % -> %',
        old.status,
        new.status;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.licia_validate_ai_pending_status_transition() from public, anon, authenticated;

drop trigger if exists trg_ai_pending_actions_status_validate
  on public.ai_pending_actions;

create trigger trg_ai_pending_actions_status_validate
before update on public.ai_pending_actions
for each row
execute function public.licia_validate_ai_pending_status_transition();

create index if not exists idx_ai_pending_user_status_created
  on public.ai_pending_actions(user_id, status, created_at desc);

create index if not exists idx_ai_pending_user_execution
  on public.ai_pending_actions(user_id, applied_at desc);

comment on table public.ai_pending_actions is
  'Licia AI confirmation queue. Allowed status flow: pending -> applied/applied_with_errors/cancelled/expired.';

notify pgrst, 'reload schema';
