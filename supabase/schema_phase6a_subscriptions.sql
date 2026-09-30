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
