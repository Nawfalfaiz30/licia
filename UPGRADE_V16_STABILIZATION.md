# Licia v16 — Stabilization & Production Hardening

Baseline: Licia v15.1.

## Preserved
- Semua file baseline tetap dipertahankan; tidak ada file baseline yang dihapus.
- Semua modul produktivitas, finance, health, calendar, focus, tasks, projects, goals, memory, vault, automation, learning, reading, habits, decisions, chat, brief, analytics, timeline, onboarding, intelligence, dan PWA tetap tersedia.

## Perbaikan penting
- Fix runtime `SoftButton is not defined` pada Settings.
- AI vision: gambar asli selalu diteruskan ke agent utama; jika pra-analisis gagal, agent masih memeriksa gambar asli.
- AI CRUD diperluas untuk Decision Journal dan Learning/Skills.
- AI bulk mutation preview + grouped undo dipertahankan dan di-hardening.
- Health delete sekarang dapat masuk ke snapshot undo.
- Middleware mengunci `/insights` seperti route aplikasi lainnya.
- Tambah app error boundary, global error boundary, loading, dan 404.
- Tambah system health check di Settings.
- Tambah `npm run verify` static verification.
- Security headers termasuk HSTS, same-origin API guard, rate-limit cleanup.
- Export API diberi same-origin, rate limit, dan no-store.
- Health API no-store.
- Performance indexes dan selective AI context tetap dipertahankan.
- PWA tidak menyimpan HTML privat/API ke cache.

## Verifikasi
- 88 file TS/TSX parsed tanpa syntax error.
- Seluruh tool definition memiliki executor.
- Tidak ada secret key yang terdeteksi.
- Tidak ada tabel Supabase asing terhadap schema_all.sql.
- 0 file baseline dihapus.

## Build
`npm install` dan `npm run build` tetap harus dijalankan pada VPS/mesin yang memiliki akses registry npm. Environment audit saat ini mengalami timeout registry sehingga build production tidak diklaim tervalidasi di sini.
