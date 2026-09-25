# Licia V30 — QA Checklist

## Static / release gates

- [ ] `npm install` / `npm ci` selesai tanpa error.
- [x] `npm run verify` → 0 syntax errors.
- [x] `npm run audit` → tidak ada obvious secret/origin leak.
- [x] `npm run test` → V30 smoke tests lulus.
- [ ] `npm run typecheck` lulus dengan dependency V30 terpasang.
- [ ] `npm run build` lulus pada mesin release.

## Database V30

- [ ] Jalankan `supabase/schema_v30_core_intelligence.sql` pada database existing.
- [ ] Untuk database baru, gunakan `supabase/schema_all_v30.sql`.
- [ ] `/system` menunjukkan Feature schema = OK.
- [ ] `life_os_events`, `ai_usage_events`, `system_health_heartbeats` tersedia.
- [ ] Kolom delivery telemetry reminders/notification_events tersedia.
- [ ] Unique active reminder index tersedia.

## Reminder end-to-end

- [ ] Buat reminder manual 1–2 menit dari sekarang.
- [ ] `/system` → `Reminder 1 menit` membuat reminder.
- [ ] `/system` → `Jalankan reminder` memproses reminder yang jatuh tempo.
- [ ] Reminder sent menghasilkan satu notification event.
- [ ] Jalankan dispatch kedua → tidak membuat push duplicate untuk event yang sudah delivered.
- [ ] Tanpa Web Push, reminder berubah `waiting_for_device` dan tetap muncul di Notification Center saat tab aktif.
- [ ] Dengan Web Push aktif, push diterima perangkat.
- [ ] Push endpoint 404/410 dibersihkan dari subscription.
- [ ] Reminder failed menampilkan `last_error` dan tombol `Jadwalkan ulang`.
- [ ] Task dihapus → reminder task menjadi cancelled.
- [ ] Schedule dihapus → reminder schedule menjadi cancelled.
- [ ] Task selesai → reminder task dibatalkan.
- [ ] Deadline task dihapus → reminder task dibatalkan.
- [ ] Undo delete task/schedule → reminder yang sebelumnya aktif dipulihkan.
- [ ] Tidak ada orphan active reminder di `/system`.

## Worker / VPS

- [ ] `pm2 status` menunjukkan `licia` dan `licia-reminder-worker`.
- [ ] Worker menggunakan `LICIA_INTERNAL_URL` di VPS yang sama.
- [ ] `system_health_heartbeats` berubah setiap siklus worker.
- [ ] `/system` menunjukkan heartbeat fresh.
- [ ] Jangan menjalankan worker PM2 dan crontab dispatcher bersamaan.
- [ ] Restart worker tidak menghilangkan reminder pending.

## AI / intelligence

- [ ] Chat memakai Context Engine.
- [ ] `/api/intelligence/context` mengembalikan signals dan focus candidates.
- [ ] `/command` dapat menjalankan command dan menampilkan action trail.
- [ ] Bulk/destructive action tetap membutuhkan confirmation.
- [ ] Undo action mengembalikan reminder bila snapshot sebelumnya ikut terpengaruh.
- [ ] `ai_usage_events` bertambah setelah request AI.
- [ ] `LICIA_AI_MODEL` dapat mengoverride model default.

## System Center

- [ ] Database status.
- [ ] Schema status.
- [ ] Reminder worker status.
- [ ] Overdue/stuck/orphan counts.
- [ ] Notification event count.
- [ ] Push device count.
- [ ] AI usage 24h.
- [ ] Service Worker status.
- [ ] Browser online/offline status.
- [ ] Browser notification test.
- [ ] Web Push test.

## PWA / browser

- [ ] HTTPS production.
- [ ] Service Worker aktif.
- [ ] Browser notification permission dapat diberikan.
- [ ] Push subscription tersimpan.
- [ ] Notification Center auto-refresh 30 detik saat tab visible.
- [ ] Tidak ada duplicate browser notification dari ID yang sama.
