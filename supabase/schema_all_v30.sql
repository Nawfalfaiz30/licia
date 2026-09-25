-- =========================================================
-- Licia — SEMUA migrasi digabung jadi satu file, urutan sudah benar.
-- Aman dijalankan ulang kapan saja (semua create table/policy/trigger
-- memakai pola idempoten: if not exists / drop-if-exists-dulu).
-- Kalau kamu sudah pernah jalankan file-file terpisah sebelumnya, jalankan
-- file ini juga tidak masalah — tidak akan menduplikasi atau menghapus data.
-- =========================================================


-- ========== dari: schema_phase1.sql ==========
-- =========================================================
-- Licia — Skema Fase 1
-- Tempel & jalankan di Supabase SQL Editor (project kamu).
-- =========================================================

-- Profil pengguna (1 baris per auth.users, id sama dengan auth.uid())
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text default 'Asia/Jakarta',
  created_at timestamptz default now(),
  preferences jsonb not null default '{}'::jsonb
);

alter table public.users add column if not exists preferences jsonb not null default '{}'::jsonb;
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


-- ========== dari: schema_phase2.sql ==========
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


-- ========== dari: fix_auto_profile.sql ==========
-- =========================================================
-- Licia — Perbaikan: auto-buat profil lewat trigger
-- Jalankan di SQL Editor SETELAH schema_phase1.sql & schema_phase2.sql.
-- Ini menggantikan pola "insert dari client saat signup", yang gagal
-- diam-diam kalau project mewajibkan konfirmasi email (RLS menolak insert
-- karena belum ada sesi login aktif).
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, display_name, timezone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Asia/Jakarta')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill untuk akun yang SUDAH terlanjur dibuat tanpa profil (mis. akun
-- kamu sekarang) — ambil nama dari metadata akun kalau ada.
insert into public.users (id, display_name, timezone)
select u.id, u.raw_user_meta_data ->> 'display_name', 'Asia/Jakarta'
from auth.users u
left join public.users p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


-- ========== dari: schema_phase3.sql ==========
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


-- ========== dari: schema_phase3b_upgrades.sql ==========
-- =========================================================
-- Licia — Upgrade kecil menyertai perbaikan Tugas/Pomodoro/Keuangan.
-- Jalankan setelah schema_phase3.sql & fix_auto_profile.sql.
-- =========================================================

-- Tugas: tambah kolom deskripsi bebas (opsional)
alter table public.tasks add column if not exists description text;

-- Pastikan kolom account_id & RLS accounts sudah ada (dibuat di schema_phase3.sql).
-- Tidak ada perubahan skema lain yang dibutuhkan untuk upgrade Keuangan/Pomodoro —
-- keduanya memakai tabel accounts/incomes/expenses/pomodoro_sessions yang sudah ada.


-- ========== dari: schema_phase4.sql ==========
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


-- ========== dari: schema_phase5.sql ==========
-- =========================================================
-- Licia — Skema Fase 5: Anime/Manga (Jikan)
-- =========================================================

-- Cache hasil fetch terakhir yang BERHASIL dari Jikan, per jenis query (mis.
-- "season_now", "top_anime", "search:naruto"). Kalau Jikan sedang down/lambat,
-- UI tetap bisa menampilkan data ini sebagai fallback alih-alih layar kosong.
-- Cache ini SHARED lintas pengguna (bukan per user_id) karena isinya data publik
-- dari Jikan, bukan data pribadi — jadi satu cache melayani semua pengguna.
create table if not exists public.jikan_cache (
  cache_key text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
-- Tabel ini dibaca/ditulis oleh server (route handler pakai service constraints
-- normal seperti tabel lain), RLS tetap diaktifkan tapi kebijakannya mengizinkan
-- semua pengguna terautentikasi membaca (data publik, non-sensitif) dan menulis
-- (menyegarkan cache) — tidak ada data pribadi di sini.
alter table public.jikan_cache enable row level security;
drop policy if exists "jikan_cache_read_all" on public.jikan_cache;
create policy "jikan_cache_read_all" on public.jikan_cache
  for select using (auth.role() = 'authenticated');
drop policy if exists "jikan_cache_write_all" on public.jikan_cache;
create policy "jikan_cache_write_all" on public.jikan_cache
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "jikan_cache_update_all" on public.jikan_cache;
create policy "jikan_cache_update_all" on public.jikan_cache
  for update using (auth.role() = 'authenticated');

-- Watchlist pribadi pengguna.
create table if not exists public.anime_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mal_id integer not null,
  title text not null,
  media_type text not null default 'anime' check (media_type in ('anime', 'manga')),
  image_url text,
  status text not null default 'plan_to_watch'
    check (status in ('watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped')),
  watched_episodes integer not null default 0,
  total_episodes integer,
  -- Hari & jam tayang disimpan dalam WIB (dikonversi dari JST -2 jam SAAT DISIMPAN,
  -- bukan JST mentah — lihat lib/jikan.ts convertJstToWib()).
  broadcast_day_wib text,
  broadcast_time_wib text,
  score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, mal_id, media_type)
);
alter table public.anime_watchlist enable row level security;
drop policy if exists "watchlist_all_own" on public.anime_watchlist;
create policy "watchlist_all_own" on public.anime_watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_watchlist_user_status on public.anime_watchlist (user_id, status);


-- ========== dari: schema_phase6a_subscriptions.sql ==========
-- =========================================================
-- Licia — Ganti Anime/Manga dengan Langganan (lebih berguna sehari-hari,
-- nyambung langsung ke fitur Keuangan). Tabel anime_watchlist/jikan_cache
-- lama dibiarkan ada (data tidak dihapus paksa), sudah tidak dipakai aplikasi.
-- =========================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric not null check (amount > 0),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  next_billing_date date,
  category text,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions_all_own" on public.subscriptions;
create policy "subscriptions_all_own" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_subscriptions_user_active on public.subscriptions (user_id, active);


-- ========== dari: schema_phase6b_sleep.sql ==========
-- =========================================================
-- Licia — Arsip modul Tidur
-- sleep_logs dipertahankan agar data lama tetap aman. UI aktif kini memakai
-- fatigue_logs sebagai check-in energi & fokus yang lebih ringan.
-- =========================================================

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sleep_start timestamptz not null,
  sleep_end timestamptz not null,
  quality integer check (quality between 1 and 5),
  created_at timestamptz default now(),
  check (sleep_end > sleep_start)
);
alter table public.sleep_logs enable row level security;
drop policy if exists "sleep_logs_all_own" on public.sleep_logs;
create policy "sleep_logs_all_own" on public.sleep_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_sleep_logs_user_end on public.sleep_logs (user_id, sleep_end desc);


-- ========== dari: schema_phase6c_personal_upgrades.sql ==========
-- =========================================================
-- Licia — Upgrade modul Personal: Target, Catatan, Bacaan, Rutinitas, Relasi
-- =========================================================

-- Target: kategori, biar bisa dikelompokkan (karier, finansial, kesehatan, dst).
alter table public.goals add column if not exists category text;

-- Catatan: bisa disematkan (pin) ke atas.
alter table public.brain_dump_notes add column if not exists pinned boolean not null default false;

-- Bacaan: genre, biar bisa lihat pola bacaan sendiri.
alter table public.reading_logs add column if not exists genre text;

-- Rutinitas: emoji/ikon biar lebih hidup & gampang dikenali sekilas.
alter table public.habits add column if not exists icon text default '✅';

-- Relasi: kelompok kontak (keluarga/teman/kerja/kenalan), biar tidak jadi satu
-- daftar panjang tak terorganisir begitu jumlah kontaknya banyak.
alter table public.social_relations add column if not exists group_type text default 'lainnya'
  check (group_type in ('keluarga', 'teman', 'kerja', 'kenalan', 'lainnya'));



-- ========== dari: schema_phase7_connected.sql ==========
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

-- ========== dari: schema_phase8_life_os.sql ==========
-- Life OS: Area, Project, Memory, Automation, Knowledge Vault + konteks tugas/agenda.
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default '◉',
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.areas enable row level security;
drop policy if exists "areas_all_own" on public.areas;
create policy "areas_all_own" on public.areas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_areas_user on public.areas(user_id, created_at asc);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid references public.areas(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  target_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.projects enable row level security;
drop policy if exists "projects_all_own" on public.projects;
create policy "projects_all_own" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_projects_user_status on public.projects(user_id, status, updated_at desc);
alter table public.goals add column if not exists area_id uuid references public.areas(id) on delete set null;
alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.tasks add column if not exists area_id uuid references public.areas(id) on delete set null;
alter table public.tasks add column if not exists estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0);
alter table public.schedule_blocks add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists idx_tasks_user_project on public.tasks(user_id, project_id, status);
create index if not exists idx_tasks_user_area on public.tasks(user_id, area_id, status);
create index if not exists idx_schedule_user_project on public.schedule_blocks(user_id, project_id);

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'preferensi',
  memory_key text not null,
  memory_value text not null,
  source text default 'manual',
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.user_memories enable row level security;
drop policy if exists "memories_all_own" on public.user_memories;
create policy "memories_all_own" on public.user_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_memories_user_enabled on public.user_memories(user_id, enabled, updated_at desc);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  action_type text not null,
  action_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.automations enable row level security;
drop policy if exists "automations_all_own" on public.automations;
create policy "automations_all_own" on public.automations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_automations_user_enabled on public.automations(user_id, enabled);

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  item_type text not null default 'note' check (item_type in ('note','link','snippet','document')),
  content text,
  source_url text,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.vault_items enable row level security;
drop policy if exists "vault_all_own" on public.vault_items;
create policy "vault_all_own" on public.vault_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_vault_user_updated on public.vault_items(user_id, updated_at desc);
create index if not exists idx_goals_user_area on public.goals(user_id, area_id);
-- Licia v12 — Enrichment: projects, memory, knowledge, health, reading, habits, people, subscriptions.
-- Jalankan setelah schema_phase8_life_os.sql.

alter table public.goals add column if not exists why text;
alter table public.goals add column if not exists next_step text;
alter table public.goals add column if not exists review_cycle text default 'weekly';

alter table public.brain_dump_notes add column if not exists title text;
alter table public.brain_dump_notes add column if not exists updated_at timestamptz default now();
alter table public.brain_dump_notes add column if not exists color text;

alter table public.reading_logs add column if not exists total_pages integer;
alter table public.reading_logs add column if not exists current_page integer default 0;
alter table public.reading_logs add column if not exists format text default 'digital';
alter table public.reading_logs add column if not exists started_at timestamptz;
alter table public.reading_logs add column if not exists finished_at timestamptz;
alter table public.reading_logs add column if not exists last_read_at timestamptz;
alter table public.reading_logs add column if not exists takeaways text;

alter table public.habits add column if not exists description text;
alter table public.habits add column if not exists preferred_time time;
alter table public.habits add column if not exists color text;
alter table public.habits add column if not exists active boolean not null default true;

alter table public.social_relations add column if not exists tags text[] default '{}';
alter table public.social_relations add column if not exists next_followup_date date;
alter table public.social_relations add column if not exists preferred_channel text;
alter table public.social_relations add column if not exists avatar_url text;
alter table public.social_interactions add column if not exists interaction_type text default 'lainnya';

alter table public.subscriptions add column if not exists reminder_days integer default 3;
alter table public.subscriptions add column if not exists service_url text;
alter table public.subscriptions add column if not exists notes text;

alter table public.skills add column if not exists target_date date;
alter table public.skills add column if not exists learning_mode text default 'practice';
alter table public.skills add column if not exists hours_spent numeric default 0;

alter table public.decisions add column if not exists tags text[] default '{}';
alter table public.decisions add column if not exists result_rating integer check (result_rating between 1 and 5);

create index if not exists idx_notes_user_updated on public.brain_dump_notes(user_id, updated_at desc);
create index if not exists idx_reading_user_updated on public.reading_logs(user_id, updated_at desc);
create index if not exists idx_habits_user_active on public.habits(user_id, active);
create index if not exists idx_relations_user_followup on public.social_relations(user_id, next_followup_date);
create index if not exists idx_subscriptions_user_due on public.subscriptions(user_id, active, next_billing_date);
create index if not exists idx_skills_user_target on public.skills(user_id, target_date);
create index if not exists idx_decisions_user_created on public.decisions(user_id, created_at desc);


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

-- ========== dari: schema_phase10_connections.sql (tambahan metrik kesehatan objektif) ==========
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

-- ========== v12.1 Modern Core / AI / UX indexes ==========
create index if not exists idx_users_preferences on public.users using gin (preferences);
create index if not exists idx_smart_inbox_open_created on public.smart_inbox_items(user_id, status, created_at desc);
create index if not exists idx_daily_plans_user_week_updated on public.daily_plans(user_id, week_start desc, updated_at desc);
comment on column public.users.preferences is 'Licia UI/UX preferences: language, startPage, weekStart, focus defaults, sound, reduced motion, density, delete confirmation.';
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

-- Licia stabilization: preview mass mutations and grouped undo.
create table if not exists public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_text text not null default '',
  timezone text not null default 'Asia/Jakarta',
  actions jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','applied','applied_with_errors','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  applied_at timestamptz,
  cancelled_at timestamptz
);
alter table public.ai_pending_actions enable row level security;
drop policy if exists "ai_pending_actions_all_own" on public.ai_pending_actions;
create policy "ai_pending_actions_all_own" on public.ai_pending_actions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_ai_pending_user_status_created on public.ai_pending_actions(user_id, status, created_at desc);
alter table public.ai_action_history add column if not exists batch_id uuid;
create index if not exists idx_ai_action_history_user_batch on public.ai_action_history(user_id, batch_id, created_at desc);
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

-- ===== Licia V30 core intelligence + reminder reliability =====
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
