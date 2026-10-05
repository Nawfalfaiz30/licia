-- =========================================================
-- Licia — Ganti "tingkat kelelahan" (angka 1-5 tanpa konteks) dengan Tracker
-- Tidur yang lebih actionable: durasi tidur otomatis dihitung dari jam
-- mulai/bangun, plus kualitas tidur. Tabel fatigue_logs lama dibiarkan ada
-- (data tidak dihapus paksa), sudah tidak dipakai aplikasi.
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
