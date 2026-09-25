# Licia V30 — Contextual Life OS

Licia V30 adalah major upgrade dari personal Life OS Licia. V30 mempertahankan domain V29 tetapi menambahkan intelligence layer, domain events, reminder reliability, AI routing, dan System Center diagnostics.

## Arsitektur

```text
UI / PWA
   ↓
Next.js 16 + React 19
   ↓
AI Context / Tool Router / Domain Services
   ↓
Life Event Bus + Reminder Engine
   ↓
Supabase + RLS
```

## Fitur inti V30

- Dashboard dan seluruh domain Life OS V29
- AI chat dengan tool calling
- Context Engine
- AI Model Router + token usage telemetry
- Durable `life_os_events`
- Reminder Engine + worker heartbeat
- Web Push + browser notification fallback
- Reminder retry/diagnostics
- System Center dengan health diagnosis
- AI action history + undo
- PWA/offline support
- Backup/restore
- Supabase RLS

## Jalankan lokal

```bash
npm install
npm run preflight:dev
npm run verify
npm run audit
npm run test
npm run dev
```

Copy `.env.local.example` menjadi `.env.local` dan isi credential yang diperlukan.

## Production

```bash
npm ci
npm run preflight
npm run verify
npm run audit
npm run test
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

Untuk deployment lengkap lihat `DEPLOY_VPS.md`.

## Database V30

Database existing:

```text
supabase/schema_all.sql
```

Migration V30:

```text
supabase/schema_v30_core_intelligence.sql
```

Bootstrap satu file:

```text
supabase/schema_all_v30.sql
```

## System Center

Buka:

```text
/system
```

System Center memeriksa database, schema V30, worker heartbeat, overdue reminder, stuck processing, orphan reminder, notification delivery, push subscription, service worker, dan AI telemetry.

## Reminder Engine

Buka:

```text
/reminders
```

Tombol penting:

- Sinkronkan agenda
- Jalankan sekarang
- Segarkan
- Jadwalkan ulang reminder gagal

Worker production:

```text
licia-reminder-worker
```

Jangan menjalankan PM2 worker dan crontab dispatcher secara bersamaan.

## Catatan build

Pada audit environment, production build belum dijalankan karena `npm install`/registry mengalami timeout dan `node_modules` tidak tersedia. Static verification tetap lulus:

```text
127 TS/TSX files
0 syntax errors
verification passed
audit passed
V30 smoke tests passed
```

## Riwayat

Catatan V20–V29 tetap disimpan di repository sebagai dokumentasi historis. Dokumen operasional aktif untuk source ini adalah `README.md`, `DEPLOY_VPS.md`, dan `V30_RELEASE_NOTES.md`.
