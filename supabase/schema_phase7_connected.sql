-- =========================================================
-- Licia — Fase 7: Connected Personal OS
-- Jalankan setelah schema_all.sql.
-- =========================================================

-- Smart Inbox: tempat menangkap apa pun sebelum dipilah.
create table if not exists public.smart_inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  kind text not null default 'inbox' check (kind in ('inbox','task','note','idea','decision','learning')),
  status text not null default 'open' check (status in ('open','processed','archived')),
  ai_suggestion jsonb,
  linked_task_id uuid references public.tasks(id) on delete set null,
  linked_note_id uuid references public.brain_dump_notes(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.smart_inbox_items enable row level security;
drop policy if exists "smart_inbox_all_own" on public.smart_inbox_items;
create policy "smart_inbox_all_own" on public.smart_inbox_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_smart_inbox_user_status_created
  on public.smart_inbox_items(user_id, status, created_at desc);

-- Decision Journal: keputusan yang bisa ditinjau kembali.
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  context text,
  options text[] default '{}',
  decision text not null,
  confidence integer not null default 3 check (confidence between 1 and 5),
  review_date date,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.decisions enable row level security;
drop policy if exists "decisions_all_own" on public.decisions;
create policy "decisions_all_own" on public.decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_decisions_user_review
  on public.decisions(user_id, review_date asc nulls last);

-- Learning / Skill tracker.
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text,
  level integer not null default 0 check (level between 0 and 100),
  target_level integer not null default 100 check (target_level between 1 and 100),
  goal_id uuid references public.goals(id) on delete set null,
  resource_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.skills enable row level security;
drop policy if exists "skills_all_own" on public.skills;
create policy "skills_all_own" on public.skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_skills_user_updated on public.skills(user_id, updated_at desc);

-- Rencana mingguan AI yang bisa disimpan dan diterapkan ke kalender.
create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_start)
);

alter table public.daily_plans enable row level security;
drop policy if exists "daily_plans_all_own" on public.daily_plans;
create policy "daily_plans_all_own" on public.daily_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_daily_plans_user_week on public.daily_plans(user_id, week_start desc);

-- Agenda bisa dikaitkan langsung ke tugas.
alter table public.schedule_blocks add column if not exists task_id uuid references public.tasks(id) on delete set null;
create index if not exists idx_schedule_user_task on public.schedule_blocks(user_id, task_id);
