# Licia 0.37.0 — Unified Life OS Upgrade

## Inti perubahan
- Navigasi utama dikonsolidasikan menjadi Beranda, Rencana, Chat, Tangkap, dan Insights.
- Tasks + Calendar + Planner + Focus mendapatkan workspace terpadu di `/plan`.
- Goals + Projects mendapatkan workspace terpadu di `/goals-projects`.
- Notes + Memory + Vault + Reading mendapatkan workspace terpadu di `/knowledge`.
- Halaman teknis tetap tersedia dan tidak dihapus; hanya dipindahkan ke area advanced/settings.
- Settings dipangkas menjadi keputusan yang benar-benar relevan untuk pengguna; menu khusus preferensi produktivitas tidak dikembalikan, sementara preference legacy tetap dipertahankan secara internal.
- Pemilihan font dikembalikan dan tetap langsung diterapkan.

## AI
- Context default berubah menjadi smart/bertahap; full Life OS hanya ketika pengguna memilihnya.
- Routing tool mendapatkan guard untuk domain privat yang diblokir pengguna.
- Action context tidak lagi dihitung pada setiap pertanyaan sederhana ketika mode proaktif tidak diperlukan.
- Iterasi tool dikurangi untuk menghindari loop dan biaya context berlebihan.
- Router model lebih sensitif terhadap operasi, penjadwalan, dan pertanyaan waktu.
- Prompt memiliki guard eksplisit untuk kombinasi nama hari + nomor tanggal.

## Tanggal dan waktu
- Resolver tanggal sekarang memvalidasi kombinasi seperti "Sabtu tanggal 26" secara deterministik.
- Bila nomor tanggal di bulan referensi tidak cocok dengan nama hari, resolver mencari tanggal mendatang yang benar-benar cocok daripada membiarkan model menebak.

## Kalender
- `schedule_blocks.completed_at` ditambahkan melalui migration V37.
- Agenda di workspace Rencana dapat ditandai selesai dan dikembalikan ke aktif.

## QA
- `npm test` dan `npm run verify` diarahkan ke suite V37.
- Manifest PWA diarahkan ke `/dashboard` dan shortcut diganti ke lima workspace utama.
- Ditambahkan static regression test yang tidak membutuhkan dependency install.

## Migrasi
Jalankan `supabase/schema_v37_unified_workspaces.sql` sekali di Supabase SQL Editor sebelum menggunakan checklist selesai pada agenda.
