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
