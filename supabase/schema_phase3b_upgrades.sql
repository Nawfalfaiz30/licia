-- =========================================================
-- Licia — Upgrade kecil menyertai perbaikan Tugas/Pomodoro/Keuangan.
-- Jalankan setelah schema_phase3.sql & fix_auto_profile.sql.
-- =========================================================

-- Tugas: tambah kolom deskripsi bebas (opsional)
alter table public.tasks add column if not exists description text;

-- Pastikan kolom account_id & RLS accounts sudah ada (dibuat di schema_phase3.sql).
-- Tidak ada perubahan skema lain yang dibutuhkan untuk upgrade Keuangan/Pomodoro —
-- keduanya memakai tabel accounts/incomes/expenses/pomodoro_sessions yang sudah ada.
