-- Licia Phase 12 — AI action history, undo, and production indexes.
-- Idempotent: safe to run after schema_all.sql.

create table if not exists public.ai_action_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  label text not null,
  operation text not null check (operation in ('create','update','delete')),
  table_name text not null,
  record_ids jsonb not null default '[]'::jsonb,
  before_snapshot jsonb,
  after_snapshot jsonb,
  undoable boolean not null default true,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ai_action_history enable row level security;
drop policy if exists "ai_action_history_all_own" on public.ai_action_history;
create policy "ai_action_history_all_own" on public.ai_action_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_ai_action_history_user_created on public.ai_action_history(user_id, created_at desc);
create index if not exists idx_tasks_user_due_status on public.tasks(user_id, status, due_at);
create index if not exists idx_schedule_user_date_time on public.schedule_blocks(user_id, block_date, start_time);
create index if not exists idx_expenses_user_category_date on public.expenses(user_id, category, occurred_at desc);
create index if not exists idx_incomes_user_date on public.incomes(user_id, occurred_at desc);
create index if not exists idx_projects_user_status_updated on public.projects(user_id, status, updated_at desc);
create index if not exists idx_goals_user_status_target on public.goals(user_id, status, target_date);
create index if not exists idx_habit_checkins_user_date on public.habit_checkins(user_id, checkin_date desc);
create index if not exists idx_pomodoro_user_completed_started on public.pomodoro_sessions(user_id, completed, started_at desc);
create index if not exists idx_inbox_user_status_created on public.smart_inbox_items(user_id, status, created_at desc);

comment on table public.ai_action_history is 'Licia AI mutation snapshots used to show transparent action history and support safe undo.';
