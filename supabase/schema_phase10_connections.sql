-- =========================================================
-- Licia — Fase 10: Connections, activity evidence & richer links
-- Jalankan setelah schema_phase9_enrichment.sql.
-- =========================================================

-- Fokus dapat menjadi bukti belajar untuk skill tertentu.
alter table public.pomodoro_sessions add column if not exists skill_id uuid references public.skills(id) on delete set null;
create index if not exists idx_pomodoro_user_skill_started on public.pomodoro_sessions(user_id, skill_id, started_at desc);

-- Keputusan dapat diberi konteks target/area agar proses review lebih bermakna.
alter table public.decisions add column if not exists goal_id uuid references public.goals(id) on delete set null;
alter table public.decisions add column if not exists area_id uuid references public.areas(id) on delete set null;
create index if not exists idx_decisions_user_goal on public.decisions(user_id, goal_id);

-- Catatan dapat hidup di dalam project/area tanpa kehilangan sifatnya sebagai tulisan bebas.
alter table public.brain_dump_notes add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.brain_dump_notes add column if not exists area_id uuid references public.areas(id) on delete set null;
create index if not exists idx_notes_user_project on public.brain_dump_notes(user_id, project_id);

-- Rutinitas dapat menjadi habit pendukung target.
alter table public.habits add column if not exists goal_id uuid references public.goals(id) on delete set null;
create index if not exists idx_habits_user_goal on public.habits(user_id, goal_id);

-- Aktivitas gerak adalah sinyal kesehatan yang lebih konkret daripada memberi skor "energi".
create table if not exists public.movement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 1440),
  intensity text not null default 'moderate' check (intensity in ('light','moderate','vigorous')),
  note text,
  logged_at timestamptz not null default now()
);
alter table public.movement_logs enable row level security;
drop policy if exists "movement_all_own" on public.movement_logs;
create policy "movement_all_own" on public.movement_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_movement_user_logged on public.movement_logs(user_id, logged_at desc);

-- Sesi membaca terpisah dari data buku agar progress punya jejak waktu yang nyata.
create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_id uuid not null references public.reading_logs(id) on delete cascade,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  pages_read integer not null default 0 check (pages_read >= 0),
  note text,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.reading_sessions enable row level security;
drop policy if exists "reading_sessions_all_own" on public.reading_sessions;
create policy "reading_sessions_all_own" on public.reading_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_reading_sessions_user_started on public.reading_sessions(user_id, started_at desc);
create index if not exists idx_reading_sessions_reading_started on public.reading_sessions(reading_id, started_at desc);

-- Opsional: cache notification lokal/proaktif tetap dapat direkonstruksi dari data aplikasi.
alter table public.automations add column if not exists last_result text;

-- Skill punya langkah praktik yang jelas agar level tidak terasa seperti angka kosong.
alter table public.skills add column if not exists next_action text;
create index if not exists idx_skills_user_goal_target on public.skills(user_id, goal_id, target_date);

-- Milestone membuat target punya langkah tengah yang bisa dirayakan dan ditinjau.
create table if not exists public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo','done')),
  target_date date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.goal_milestones enable row level security;
drop policy if exists "goal_milestones_all_own" on public.goal_milestones;
create policy "goal_milestones_all_own" on public.goal_milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_goal_milestones_user_goal on public.goal_milestones(user_id, goal_id, position, created_at);

-- Data kesehatan objektif tambahan: metrik fisik opsional tanpa membuat diagnosis atau skor subjektif.
create table if not exists public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric check (weight_kg is null or (weight_kg > 0 and weight_kg <= 500)),
  systolic integer check (systolic is null or (systolic > 0 and systolic <= 300)),
  diastolic integer check (diastolic is null or (diastolic > 0 and diastolic <= 200)),
  resting_hr integer check (resting_hr is null or (resting_hr > 0 and resting_hr <= 250)),
  note text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (weight_kg is not null or systolic is not null or diastolic is not null or resting_hr is not null)
);
alter table public.health_metrics enable row level security;
drop policy if exists "health_metrics_all_own" on public.health_metrics;
create policy "health_metrics_all_own" on public.health_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_health_metrics_user_measured on public.health_metrics(user_id, measured_at desc);
