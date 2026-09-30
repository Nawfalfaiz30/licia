# Licia 0.36.0 — Intelligence & Trust Upgrade

V36 menyatukan modul V35 tanpa menambah integrasi pihak ketiga.

## Upgrade utama

- Temporal Engine deterministik untuk `hari ini`, `besok`, `Sabtu`, `Sabtu tanggal 26`, `minggu ini`, dan `minggu depan`, termasuk validasi weekday/date.
- Life Copilot proaktif untuk task terlambat, risiko project/goal, inbox, subscription, keputusan, kapasitas, konflik kalender, dan ruang fokus.
- Calendar Intelligence mendeteksi overlap dan mencari free window 30+ menit.
- AI Action Plan Center dengan confidence reason, evidence, lifecycle, cancel propagation, dan status setelah batch diterapkan.
- Evidence feedback (`berguna` / `kurang tepat`) untuk membantu menyaring insight yang bermanfaat.
- Weekly Review Center dan narasi review berbasis aktivitas nyata.
- Universal Search diberi konteks Life Copilot dan koneksi ke chat.
- Life Graph diperkuat menjadi Graph Context untuk hubungan Goal → Project → Task → Agenda.
- Privacy Center untuk kontrol konteks AI.
- Offline Workspace menyimpan snapshot Copilot di IndexedDB dan tetap dapat menampilkan next move ketika offline.
- Smart Capture dapat mengirim teks/gambar langsung ke Chat Licia untuk vision/tool workflow.
- Pengaturan V36 untuk mengaktifkan/menonaktifkan lapisan Intelligence tanpa menghapus fitur V35.
- Navigasi mobile dipadatkan menjadi Home / Today / Chat / Capture + More.

## Migration

Jalankan:

```sql
supabase/schema_v36_intelligence.sql
```

Setelah migration, restart/refresh PostgREST bila environment deployment membutuhkan refresh schema cache.

## Catatan deployment

V36 tidak menambahkan Google Calendar, Gmail, Drive, browser extension, webhook eksternal, atau provider pihak ketiga lain. Semua fitur baru bekerja dengan data dan infrastruktur yang sudah ada di Licia.

## Pemeriksaan

Script berikut dapat dijalankan setelah dependency terpasang:

```bash
npm run test:v36
npm run test:v35
npm run typecheck
npm run build
```

## Build fix setelah V36.0.0

Perbaikan kompatibilitas TypeScript yang diterapkan setelah verifikasi build produksi:

- `BooleanPreference` di Settings diperluas dengan seluruh preference V36: `lifeCopilot`, `evidenceLayer`, `calendarGuard`, `smartReview`, `adaptiveWidgets`, `offlineWorkspace`, `privacyCenter`, dan `voiceVisionCapture`.
- `ActionPlanCenter` menormalkan `evidence` optional menjadi array kosong sebelum membaca `.length`/`.slice`, sehingga tidak menghasilkan TS18048.
- `cacheWorkspaceSnapshot()` menghilangkan properti object literal `key` ganda dengan menyimpan key scoped pada `key` dan nama logical key pada `workspaceKey`, sehingga tidak menghasilkan TS1117.

Validasi:

```bash
npm run test:v36
```

PASS seluruh suite V36. Parser TypeScript/TSX juga memvalidasi 191 file tanpa syntax error.
