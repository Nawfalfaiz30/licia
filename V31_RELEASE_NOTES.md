# Licia V31 — Release Notes

## Fokus

Licia V31 memusatkan reliability pada tiga jalur utama: Web Push, Reminder Worker, dan Sync Core multi-device.

## Web Push & Reminder Worker

- VAPID configuration validation server-side.
- `SUPABASE_SERVICE_ROLE_KEY` validation sebelum push delivery.
- `LICIA_CRON_SECRET` untuk autentikasi worker.
- `npm run setup:push` untuk membuat VAPID keypair dan cron secret jika belum ada.
- PM2 `licia-reminder-worker` menjalankan dispatcher kontinu.
- Fallback `scripts/reminder-cron.mjs` tersedia untuk cron OS; jangan menjalankan dua dispatcher bersamaan.
- System Center menampilkan status worker, heartbeat, Web Push, dan variabel yang masih kurang tanpa membocorkan secret.

## Sync Core

Migration `supabase/schema_v31_sync.sql` menambahkan:

- device registry per user,
- monotonic sync event cursor,
- mutation idempotency record,
- row version untuk conflict detection,
- delete tombstone event,
- trigger event otomatis untuk task, schedule, project, goal, notes, inbox, reminders, dan memories,
- Supabase Realtime delivery pada sync event stream.

Client `SyncManager` melakukan register device, pull cursor, invalidation/revalidation, focus/online sync, dan Realtime-assisted low-latency refresh.

## Offline

Offline quick capture sekarang replay melalui `/api/sync/mutation`, bukan insert langsung ke Supabase. Queue mempunyai batas configurable dari Settings.

## Settings

Pengaturan baru/penyempurnaan:

- Enter-to-send benar-benar menghormati toggle.
- Saat aktif: Enter mengirim, Shift+Enter membuat baris baru.
- Saat nonaktif: Enter membuat baris baru, Ctrl/Cmd+Enter mengirim.
- AI mode dan response style melakukan normalisasi legacy value.
- Task sorting selaras dengan domain task (`next`, `priority`, `effort`).
- Sync interval, offline queue limit, conflict strategy, push auto-reconnect, dan sync status visibility.

## Security

`.env.local` dan credential runtime tidak boleh masuk ZIP/repository. Credential yang pernah terekspos harus segera dirotasi di provider masing-masing.
