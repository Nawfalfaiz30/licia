-- =========================================================
-- Licia — Skema Fase 4: Jurnal, Catatan, Bacaan, Relasi, Kebiasaan
-- Jalankan setelah semua file schema sebelumnya.
-- =========================================================

-- Jurnal
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mood_score integer not null check (mood_score between 1 and 5),
  content text not null,
  created_at timestamptz default now()
);
alter table public.journal_entries enable row level security;
drop policy if exists "journal_all_own" on public.journal_entries;
create policy "journal_all_own" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Catatan cepat
create table if not exists public.brain_dump_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  tags text[] default '{}',
  created_at timestamptz default now()
);
alter table public.brain_dump_notes enable row level security;
drop policy if exists "notes_all_own" on public.brain_dump_notes;
create policy "notes_all_own" on public.brain_dump_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bacaan
create table if not exists public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text,
  cover_url text,
  status text not null default 'reading' check (status in ('want_to_read', 'reading', 'finished')),
  progress integer default 0 check (progress between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.reading_logs enable row level security;
drop policy if exists "reading_all_own" on public.reading_logs;
create policy "reading_all_own" on public.reading_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Relasi (CRM ringan)
create table if not exists public.social_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_name text not null,
  importance text not null default 'normal' check (importance in ('normal', 'penting', 'sangat_penting')),
  contact_frequency_days integer not null default 30,
  birthday date,
  notes text,
  created_at timestamptz default now()
);
alter table public.social_relations enable row level security;
drop policy if exists "relations_all_own" on public.social_relations;
create policy "relations_all_own" on public.social_relations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.social_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  relation_id uuid not null references public.social_relations (id) on delete cascade,
  note text,
  occurred_at timestamptz not null default now()
);
alter table public.social_interactions enable row level security;
drop policy if exists "interactions_all_own" on public.social_interactions;
create policy "interactions_all_own" on public.social_interactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kebiasaan
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_per_week integer not null default 7 check (target_per_week between 1 and 7),
  created_at timestamptz default now()
);
alter table public.habits enable row level security;
drop policy if exists "habits_all_own" on public.habits;
create policy "habits_all_own" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  checkin_date date not null default current_date,
  created_at timestamptz default now(),
  unique (habit_id, checkin_date)
);
alter table public.habit_checkins enable row level security;
drop policy if exists "habit_checkins_all_own" on public.habit_checkins;
create policy "habit_checkins_all_own" on public.habit_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_journal_user_created on public.journal_entries (user_id, created_at desc);
create index if not exists idx_notes_user_created on public.brain_dump_notes (user_id, created_at desc);
create index if not exists idx_reading_user_status on public.reading_logs (user_id, status);
create index if not exists idx_relations_user on public.social_relations (user_id);
create index if not exists idx_interactions_relation on public.social_interactions (relation_id, occurred_at desc);
create index if not exists idx_habit_checkins_habit_date on public.habit_checkins (habit_id, checkin_date desc);

-- Upgrade Kalender: field lokasi & deskripsi untuk blok jadwal.
alter table public.schedule_blocks add column if not exists location text;
alter table public.schedule_blocks add column if not exists description text;

-- Upgrade Kesehatan: estimasi gizi otomatis dari AI saat mencatat makan lewat chat.
alter table public.meal_logs add column if not exists calories numeric;
alter table public.meal_logs add column if not exists protein_g numeric;
alter table public.meal_logs add column if not exists carbs_g numeric;
alter table public.meal_logs add column if not exists fat_g numeric;

-- Ganti Jurnal (tumpang tindih dengan Catatan) dengan Target/Goals — untuk tujuan
-- jangka menengah/panjang dengan progres, beda jelas dari Tugas (sekali selesai),
-- Kebiasaan/Rutinitas (berulang), dan Catatan (tulisan bebas tanpa struktur).
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'active' check (status in ('active', 'achieved', 'abandoned')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.goals enable row level security;
drop policy if exists "goals_all_own" on public.goals;
create policy "goals_all_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_goals_user_status on public.goals (user_id, status);

-- Upgrade Bacaan: rating & catatan pribadi, tanpa sampul (dihapus agar lebih ringan).
alter table public.reading_logs add column if not exists rating integer check (rating between 1 and 5);
alter table public.reading_logs add column if not exists notes text;
