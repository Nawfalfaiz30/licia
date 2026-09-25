-- =========================================================
-- Licia — Skema Fase 1
-- Tempel & jalankan di Supabase SQL Editor (project kamu).
-- =========================================================

-- Profil pengguna (1 baris per auth.users, id sama dengan auth.uid())
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text default 'Asia/Jakarta',
  created_at timestamptz default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- Tugas
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;
drop policy if exists "tasks_all_own" on public.tasks;
create policy "tasks_all_own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Subtugas
create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'done')),
  created_at timestamptz default now()
);

alter table public.subtasks enable row level security;
drop policy if exists "subtasks_all_own" on public.subtasks;
create policy "subtasks_all_own" on public.subtasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pengeluaran
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null check (amount > 0),
  category text not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;
drop policy if exists "expenses_all_own" on public.expenses;
create policy "expenses_all_own" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Log audit pemanggilan tool AI (untuk debugging)
create table if not exists public.ai_function_call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  raw_user_text text,
  function_name text not null,
  arguments jsonb,
  status text not null,
  created_at timestamptz default now()
);

alter table public.ai_function_call_logs enable row level security;
drop policy if exists "ai_logs_all_own" on public.ai_function_call_logs;
create policy "ai_logs_all_own" on public.ai_function_call_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index bantu untuk query ringkasan/pencarian
create index if not exists idx_expenses_user_occurred on public.expenses (user_id, occurred_at desc);
create index if not exists idx_tasks_user_status on public.tasks (user_id, status);
