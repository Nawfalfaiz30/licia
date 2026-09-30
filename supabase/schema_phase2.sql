-- =========================================================
-- Licia — Skema Fase 2 (jalankan setelah schema_phase1.sql)
-- =========================================================

-- Sesi Pomodoro
create table if not exists public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  focus_minutes integer not null check (focus_minutes > 0),
  started_at timestamptz not null default now(),
  completed boolean not null default true,
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz default now()
);

alter table public.pomodoro_sessions enable row level security;
drop policy if exists "pomodoro_all_own" on public.pomodoro_sessions;
create policy "pomodoro_all_own" on public.pomodoro_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Blok jadwal (kalender harian)
create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  block_date date not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  created_by text not null default 'manual' check (created_by in ('ai', 'manual')),
  created_at timestamptz default now(),
  check (end_time > start_time)
);

alter table public.schedule_blocks enable row level security;
drop policy if exists "schedule_all_own" on public.schedule_blocks;
create policy "schedule_all_own" on public.schedule_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_schedule_user_date on public.schedule_blocks (user_id, block_date);
create index if not exists idx_pomodoro_user_started on public.pomodoro_sessions (user_id, started_at desc);

-- Connected upgrade: agenda dapat terhubung langsung ke tugas.
alter table public.schedule_blocks add column if not exists task_id uuid references public.tasks(id) on delete set null;
create index if not exists idx_schedule_user_task on public.schedule_blocks(user_id, task_id);
