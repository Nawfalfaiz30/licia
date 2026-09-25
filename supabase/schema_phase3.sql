-- =========================================================
-- Licia — Skema Fase 3 (jalankan setelah phase1, phase2, fix_profile_trigger)
-- =========================================================

-- Akun/dompet
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  starting_balance numeric not null default 0,
  created_at timestamptz default now()
);

alter table public.accounts enable row level security;
drop policy if exists "accounts_all_own" on public.accounts;
create policy "accounts_all_own" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Hubungkan expenses ke account (opsional, kolom baru kalau belum ada)
alter table public.expenses add column if not exists account_id uuid references public.accounts (id) on delete set null;

-- Pemasukan
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null check (amount > 0),
  source text not null,
  note text,
  account_id uuid references public.accounts (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.incomes enable row level security;
drop policy if exists "incomes_all_own" on public.incomes;
create policy "incomes_all_own" on public.incomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anggaran (budget per kategori per periode)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  limit_amount numeric not null check (limit_amount > 0),
  period text not null default 'monthly' check (period in ('weekly', 'monthly')),
  created_at timestamptz default now(),
  unique (user_id, category, period)
);

alter table public.budgets enable row level security;
drop policy if exists "budgets_all_own" on public.budgets;
create policy "budgets_all_own" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kesehatan: satu tabel per jenis log, kolom disesuaikan per jenis
create table if not exists public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_ml integer not null check (amount_ml > 0),
  logged_at timestamptz not null default now()
);
alter table public.hydration_logs enable row level security;
drop policy if exists "hydration_all_own" on public.hydration_logs;
create policy "hydration_all_own" on public.hydration_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.caffeine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  drink text not null,
  mg_estimate integer,
  logged_at timestamptz not null default now()
);
alter table public.caffeine_logs enable row level security;
drop policy if exists "caffeine_all_own" on public.caffeine_logs;
create policy "caffeine_all_own" on public.caffeine_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_type text check (meal_type in ('sarapan', 'makan_siang', 'makan_malam', 'camilan')),
  description text not null,
  logged_at timestamptz not null default now()
);
alter table public.meal_logs enable row level security;
drop policy if exists "meal_all_own" on public.meal_logs;
create policy "meal_all_own" on public.meal_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  medication_name text not null,
  dosage text,
  logged_at timestamptz not null default now()
);
alter table public.medication_logs enable row level security;
drop policy if exists "medication_all_own" on public.medication_logs;
create policy "medication_all_own" on public.medication_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.fatigue_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fatigue_score integer not null check (fatigue_score between 1 and 5),
  note text,
  logged_at timestamptz not null default now()
);
alter table public.fatigue_logs enable row level security;
drop policy if exists "fatigue_all_own" on public.fatigue_logs;
create policy "fatigue_all_own" on public.fatigue_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_incomes_user_occurred on public.incomes (user_id, occurred_at desc);
create index if not exists idx_hydration_user_logged on public.hydration_logs (user_id, logged_at desc);
create index if not exists idx_caffeine_user_logged on public.caffeine_logs (user_id, logged_at desc);
create index if not exists idx_meal_user_logged on public.meal_logs (user_id, logged_at desc);
create index if not exists idx_medication_user_logged on public.medication_logs (user_id, logged_at desc);
create index if not exists idx_fatigue_user_logged on public.fatigue_logs (user_id, logged_at desc);
