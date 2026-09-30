# Licia 0.37.0 — Unified Life OS Upgrade

Versi ini merapikan Licia tanpa menghapus route lama. Modul lama tetap dapat diakses, tetapi pengalaman utama dipusatkan pada lima pilar:

- **Beranda** — kondisi hari ini dan Next Move.
- **Rencana** — tasks, agenda, planner, dan fokus dalam satu alur.
- **Chat Licia** — satu antarmuka AI untuk membaca, merencanakan, dan menjalankan aksi.
- **Tangkap** — tempat masuk teks, suara, gambar, dan Inbox.
- **Insights** — review, pola, koneksi, dan analitik.

## Perubahan besar

### 1. Navigasi dikonsolidasikan
Route legacy tidak dihapus. Navigasi utama sekarang hanya menonjolkan lima pilar. Modul teknis dipindahkan ke More/Settings.

### 2. Workspace baru
`/plan` menyatukan tugas + agenda dan memungkinkan checklist langsung pada keduanya.

`/goals-projects` menyatukan hubungan **Goal → Project → Task**.

`/knowledge` menyatukan Notes, Memory, Vault, dan Reading.

### 3. Settings disederhanakan
UI preference dipangkas menjadi beberapa keputusan penting. Preference legacy tetap dipertahankan di database sehingga kemampuan internal lama tidak ikut hilang.

### 4. Context AI lebih hemat
AI sekarang default ke **smart context**. Context actionable hanya dibangun untuk permintaan yang memang berpotensi membutuhkan aksi/proactive assistance.

Mode akses seluruh Life OS tetap tersedia melalui preference `aiContextMode=all`, tetapi tool lintas-modul dibatasi ketika ada domain privacy yang dinonaktifkan.

### 5. Privacy per domain
Settings menyediakan kontrol per domain. Secara default pada settings baru:

- Tasks, Calendar, Goals, Projects, Notes, Memory, Learning, Reading: aktif.
- Finance, Health, Vault: nonaktif sampai pengguna mengizinkannya.

### 6. Temporal/date guard
Permintaan seperti **"Sabtu tanggal 26"** tidak lagi dibebankan sepenuhnya kepada model bahasa. Licia memvalidasi pasangan tanggal + hari terlebih dahulu.

Jika tanggal numerik dan hari yang disebut tidak cocok, engine mencari tanggal berikutnya yang benar-benar cocok. Jika tanggal eksplisit memang sudah lewat tetapi hari cocok, tanggal eksplisit dipertahankan dan diberi penanda bahwa tanggal tersebut telah lewat.

### 7. Action receipt
Chat sekarang menampilkan ringkasan aksi yang dijalankan dan tetap menyediakan undo ketika server mengembalikan `undoActionId`.

### 8. Regression checks
`npm test` dan `npm run verify` sekarang menunjuk ke suite V37, bukan suite lama V34.

## Migrasi database

Jalankan satu kali:

```sql
-- supabase/schema_v37_unified_workspaces.sql
alter table public.schedule_blocks
  add column if not exists completed_at timestamptz;

create index if not exists idx_schedule_blocks_user_completed_date
  on public.schedule_blocks(user_id, completed_at, block_date);
```

Column `completed_at` dipakai workspace Rencana untuk menandai agenda sebagai selesai.

## Build setelah ekstraksi

```bash
npm ci
npm run test
npm run verify
npm run typecheck
npm run build
```

Untuk VPS production:

```bash
npm ci
npm run build
npm start
```

## Catatan kompatibilitas

- Route lama tetap ada.
- Preference legacy tidak dihapus dari JSON `users.preferences`.
- Jika profil lama memiliki `aiReadAllData=true` tetapi belum memiliki `aiContextMode`, perilaku tersebut tetap dihormati sampai preference eksplisit baru tersimpan.
- `schedule_blocks.completed_at` memerlukan migration SQL di atas.
