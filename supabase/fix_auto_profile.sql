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
