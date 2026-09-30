# Licia V27 — Full Life OS Overhaul

Tanggal audit: 25 September 2026

## Scope

V27 melakukan overhaul besar berbasis V25 untuk menjadikan Licia lebih dekat ke Personal Life OS yang terintegrasi. Fokus utama:

- Dashboard information-first dan lintas modul.
- Quick Search mobile yang benar-benar viewport-aware dan portal-based.
- Settings Control Center yang tidak menutupi konten ketika scroll.
- Health responsive/mobile-safe.
- Goals/Target dengan roadmap, milestone, review cycle, koneksi project/task, deadline, dan momentum.
- AI Action Log untuk transparansi operasi AI dan undo.
- Backup & Restore JSON merge untuk data pribadi.
- Integrasi Daily Intelligence, Activity Feed, Timeline, Weekly Review, Automations, Life Command, Smart Inbox, Memory, Analytics, dan modul Life OS lain yang sudah ada.

## Perubahan Utama

### Dashboard
Urutan baru memprioritaskan konteks:
1. Greeting + aksi utama.
2. Daily Intelligence.
3. Metric ringkas lintas sistem.
4. Agenda/tugas/inbox yang perlu diperhatikan.
5. Keuangan bulan berjalan + saldo.
6. Goals/roadmap + kesehatan.
7. Sistem utama dan ritme aktivitas.
8. Activity Feed + Weekly Review.

Dashboard juga menghormati beberapa preferensi widget dari profile preferences.

### Quick Search
- Rendering melalui portal ke `document.body`.
- Mobile memakai panel fixed berbasis viewport.
- Backdrop mobile agar fokus tidak tertutup layout topbar.
- Internal scrolling.
- Tombol close eksplisit.
- Search + command prefix `>`.
- Shortcut module tidak lagi membentuk daftar tinggi yang sulit dibaca di HP.

### Settings
- Model Control Center berbasis section.
- Hanya section aktif yang dirender sehingga tidak ada tab sticky yang menutupi pengaturan lain saat scroll.
- Navigator 2 kolom di mobile.
- Tampilan, AI, Workspace, Pengalaman, dan Data dipisahkan jelas.
- Tetap mempertahankan preference model dan Data Export.
- Ditambah Data Backup/Restore, AI Action Log, Timeline, Health Check, dan logout.

### Health
- Layout mobile lebih fleksibel.
- Tombol aksi memakai ukuran aman untuk viewport sempit.
- Input/grid diberi `min-width: 0` dan max-width yang aman.
- Fitur log kesehatan yang sudah ada tetap dipertahankan.

### Goals
- Portfolio target dan statistik tambahan.
- Progress dan deadline.
- Milestone roadmap.
- Koneksi project/task.
- Next step dan alasan target.
- Review cycle dan indikator review dekat.
- Insight momentum / roadmap / review.
- Filter kategori, status, dan pencarian.

### AI Action History
Route baru: `/ai-history`

Menampilkan operasi AI yang tercatat, termasuk:
- operation create/update/delete
- tool dan tabel yang terpengaruh
- jumlah record
- batch identifier
- status undo
- waktu aksi

Aksi yang mendukung snapshot dapat di-undo melalui `/api/ai/undo`.

### Backup & Restore
Route API baru: `/api/backup`

GET membuat backup JSON terstruktur dari profile dan tabel Life OS yang di-allowlist.
POST melakukan restore mode MERGE:
- row dengan ID yang sama di-upsert
- `user_id` dipaksa ke user terautentikasi
- data yang tidak ada di backup tidak dihapus
- ukuran payload dibatasi
- same-origin dan rate limit tetap diberlakukan

UI ada di Settings melalui `DataBackupButton`.

## Perbaikan Schema yang Ditemukan

- Query goal Dashboard menggunakan status `active` yang sesuai schema.
- Query tugas selesai hari ini tidak lagi menggunakan `completed_at` karena field tersebut tidak ada di schema; memakai `updated_at` sebagai proxy sesuai struktur data saat ini.
- Dashboard reading memakai `reading_logs`, bukan field `book_title` dari tabel yang tidak sesuai.

## Audit

Lolos:
- `node scripts/verify.mjs`
- Parser check: 102 file TS/TSX, 0 syntax errors.
- CSS parse errors: 0.
- CSS braces: seimbang.
- Literal `\\n` di `app/globals.css`: 0.
- Hardcoded runtime `localhost:3000` / `127.0.0.1:3000` di `app`, `components`, `lib`: 0.

Belum dapat dijalankan penuh di workspace ini:
- `npm run build`
- full TypeScript/Lint melalui dependency project

Alasan: `node_modules` belum tersedia dan instalasi dependency melalui `npm install --ignore-scripts` tidak selesai dalam waktu eksekusi workspace. Selain itu preflight produksi membutuhkan env deployment yang memang tidak disimpan di source archive.

## Verifikasi Lokal yang Disarankan

```powershell
npm install
npm run preflight
npm run verify
npm run build
```

Untuk production, isi env yang dibutuhkan project sebelum `npm run preflight`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
NEXT_PUBLIC_SITE_URL=https://licia.site
APP_URL=https://licia.site
DEV_TUNNEL_ORIGIN=
```

Jangan memasukkan secret ke Git/ZIP source.

## Catatan Produk

V27 memperkuat arsitektur untuk fitur yang sudah ada sekaligus menyiapkan pondasi bagi Personal Life OS yang lebih agentic: Daily Intelligence, universal command, contextual reads, batch AI actions, AI action audit/undo, automation, timeline, weekly review, backup/restore, dan personal analytics.

## Post-build hotfix — Health duplicate identifier

Build reported a TypeScript/webpack collision in `app/(app)/health/page.tsx`: the React state `caffeine` was declared alongside a derived `const caffeine` total. The derived value has been renamed to `caffeineTotal`; the input state remains `caffeine`.

Validation after hotfix:
- `npm run verify` — PASS
- TypeScript parser — 0 syntax errors
- Semantic duplicate/redeclaration diagnostic scan — 0 matching redeclaration errors
- Full `npm run build` could not be executed in the audit container because project dependencies are not installed there; an `npm install` attempt timed out and no `node_modules` directory was created.
