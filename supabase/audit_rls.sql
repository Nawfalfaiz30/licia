-- Audit RLS pada database yang sedang berjalan (E1). Jalankan di Supabase SQL Editor.
-- Hasil kosong = aman. Setiap baris adalah tabel public yang RLS-nya mati atau tanpa kebijakan.
select c.relname as tabel,
       c.relrowsecurity as rls_aktif,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as jumlah_kebijakan
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and (
    not c.relrowsecurity
    or not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
  )
order by c.relname;
