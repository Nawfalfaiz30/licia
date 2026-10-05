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
