# Licia V31 — Deployment VPS Ubuntu

Licia V31 adalah baseline production baru setelah upgrade dari V30. Stack utama:

- Next.js 16.x + React 19.x
- Supabase + RLS
- OpenAI tool-calling + AI model router
- Reminder Engine V31 + server heartbeat
- Web Push + PWA
- PM2 + Nginx

V31 tetap cocok untuk VPS Ubuntu dengan Node 22. Jangan menyalin source V31 ke folder lama. Gunakan folder deploy bersih agar file stale tidak tertinggal.

## 1. Requirement

- Ubuntu 22.04/24.04
- Node.js 22.x
- npm 10+
- PM2
- Nginx
- Supabase production project
- Domain + HTTPS sangat dianjurkan untuk PWA/Web Push
- Swap minimal 2 GB untuk VPS kecil saat build

## 2. Deploy source

```bash
cd /root
mv licia licia-backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
mkdir -p licia
unzip licia-v31.zip -d licia
cd licia
```

Pastikan:

```bash
ls package.json proxy.ts
```

## 3. Environment

Buat `.env.local` dari `.env.local.example`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

NEXT_PUBLIC_SITE_URL=https://licia.example.com
APP_URL=https://licia.example.com
LICIA_INTERNAL_URL=http://127.0.0.1:3000

VAPID_SUBJECT=mailto:admin@example.com
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
LICIA_CRON_SECRET=...
LICIA_AI_MODEL=gpt-4o-mini
LICIA_AI_HEAVY_MODEL=gpt-4o-mini
```

`LICIA_INTERNAL_URL` dipakai worker untuk komunikasi internal VPS sehingga tidak perlu melewati DNS/Nginx/public HTTPS.

## 4. Database migration V30 + V31

Jalankan **sekali** di Supabase SQL Editor:

```text
supabase/schema_v30_core_intelligence.sql
supabase/schema_v31_sync.sql
```

V31 menambahkan device registry, sync event stream, mutation idempotency, row versioning, dan tombstone delete event. Kedua file dapat dijalankan berurutan pada database existing. Untuk instalasi database dari nol, gunakan:

```text
supabase/schema_all_v30.sql
```

Migration V30 menambahkan:

- `life_os_events`
- `ai_usage_events`
- `system_health_heartbeats`
- delivery telemetry pada reminders/notification_events
- unique active reminder guard
- trigger pembatalan reminder ketika task/schedule dihapus atau task selesai/deadline dihapus

## 5. Install dependency

```bash
npm install
npm run preflight
npm run verify
npm run audit
npm run test
```

Untuk deployment yang reproducible, commit `package-lock.json` yang dihasilkan di mesin/VPS yang memiliki akses registry, lalu gunakan pada deployment berikutnya:

```bash
npm ci
```

## 6. Build

V31 memakai Node 22 dan build script dengan memory guard:

```bash
sudo fallocate -l 2G /swapfile 2>/dev/null || true
sudo chmod 600 /swapfile
sudo mkswap /swapfile 2>/dev/null || true
sudo swapon /swapfile 2>/dev/null || true

npm run build
```

`npm run build` menjalankan `scripts/build.mjs`, yang membatasi Node ke heap sekitar 1 GB sebelum memanggil Next build.

## 7. PM2

```bash
pm2 delete licia licia-reminder-worker 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# jalankan command sudo yang dicetak PM2
pm2 save
pm2 status
```

Ada dua process:

```text
licia
licia-reminder-worker
```

Aplikasi listen di `127.0.0.1:3000`.

## 8. Nginx

Gunakan konfigurasi pada `deploy/nginx-licia.conf`.

```bash
sudo cp deploy/nginx-licia.conf /etc/nginx/sites-available/licia
sudo ln -sf /etc/nginx/sites-available/licia /etc/nginx/sites-enabled/licia
sudo nginx -t
sudo systemctl reload nginx
```

Pastikan domain mengarah ke VPS dan HTTPS aktif sebelum menguji Web Push.

## 9. Web Push

Generate key:

```bash
npx web-push generate-vapid-keys
```

Simpan public/private key di `.env.local`. Jangan commit secret.

Setelah login di browser production:

1. Buka `/system`.
2. Tes browser notification.
3. Aktifkan Push dari Settings.
4. Jalankan `Reminder 1 menit`.
5. Klik `Jalankan reminder` bila ingin menguji dispatch manual.
6. Gunakan `Kirim tes push` untuk jalur Web Push.

## 10. Reminder worker 24/7

Worker PM2 menjalankan dispatch kira-kira setiap 60 detik dan mengirim heartbeat ke `system_health_heartbeats`.

Periksa:

```bash
pm2 status
pm2 logs licia-reminder-worker --lines 100
```

Health UI:

```text
/system
```

System Center akan memperlihatkan:

- heartbeat worker
- overdue reminder
- reminder stuck
- orphan reminder
- notification delivery
- push subscription
- V30 + V31 schema
- Sync device registry/event cursor
- AI usage telemetry
- V31 Sync Core untuk multi-device/offline/idempotency

Crontab OS tetap tersedia sebagai fallback, tetapi **jangan aktifkan PM2 worker dan crontab bersamaan**, karena keduanya dapat memanggil dispatcher yang sama.

## 11. Healthcheck

```bash
curl http://127.0.0.1:3000/api/health
curl https://licia.example.com/api/health
```

Secret tidak pernah ditampilkan oleh health endpoint.

## 12. Update release berikutnya

Backup folder lama lalu deploy V31 ke folder bersih:

```bash
cd /root
mv licia licia-backup-$(date +%Y%m%d-%H%M%S)
mkdir licia
unzip licia-v31.zip -d licia
cd licia
npm ci
npm run verify
npm run audit
npm run test
npm run build
pm2 restart ecosystem.config.cjs --update-env
pm2 save
```

Setelah restart, buka `/system` dan pastikan worker heartbeat tidak stale.

## 13. Troubleshooting cepat

### Reminder tidak terkirim

Periksa `/system`.

Jika `Worker` stale:

```bash
pm2 restart licia-reminder-worker --update-env
pm2 logs licia-reminder-worker --lines 100
```

Jika `waiting_for_device`, pastikan ada subscription Web Push aktif.

Jika `failed`, lihat `last_error` pada `/reminders` lalu gunakan `Jadwalkan ulang`.

### Migration belum lengkap

Jalankan:

```text
supabase/schema_v30_core_intelligence.sql
supabase/schema_v31_sync.sql
```

kemudian `/system` → `Segarkan`.

### PWA/push tidak aktif

Pastikan production dibuka melalui HTTPS dan service worker sudah aktif. IP-only HTTP tidak menjamin secure context untuk semua kemampuan browser.


## Licia V31 — Web Push, Reminder Worker, dan Sync Core

Setelah source V31 di-deploy:

```bash
cd /var/www/licia
npm ci
npm run setup:push
```

`npm run setup:push` membuat pasangan VAPID jika belum ada dan membuat `LICIA_CRON_SECRET`. Jangan masukkan secret ke Git, ZIP, atau dokumentasi publik. Pastikan environment production berisi:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
NEXT_PUBLIC_SITE_URL=https://domain-anda
APP_URL=https://domain-anda
VAPID_SUBJECT=mailto:admin@domain-anda
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
LICIA_CRON_SECRET=...
LICIA_INTERNAL_URL=http://127.0.0.1:3000
LICIA_REMINDER_WORKER_INTERVAL_MS=60000
```

Jalankan `supabase/schema_v31_sync.sql` di Supabase SQL Editor. Setelah migration sukses:

```bash
npm run preflight
npm run audit
npm run verify
npm run typecheck
npm run build
pm2 start ecosystem.config.cjs --update-env
pm2 save
pm2 status
pm2 logs licia-reminder-worker --lines 100
```

Worker reminder wajib hidup di VPS. Browser polling pada Notification Center bukan pengganti worker production.


### Fallback cron (pilih salah satu; jangan menjalankan PM2 worker dan cron fallback bersamaan)

```bash
cd /var/www/licia
* * * * * cd /var/www/licia && /usr/bin/node scripts/reminder-cron.mjs >> /var/log/licia-reminder-cron.log 2>&1
```

Rekomendasi production tetap menggunakan `licia-reminder-worker` melalui PM2 karena interval dapat berjalan lebih rapat daripada cron satu menit. Cron di atas hanya fallback saat PM2 worker tidak digunakan.


## Licia V32 — Sync Core & Experience

Setelah deployment V31 berhasil, jalankan migration tambahan:

```text
supabase/schema_v32_sync_experience.sql
```

Kemudian verifikasi:

```bash
npm run verify:v32
npm run verify
npm run test
npm run audit
```

V32 menambahkan conflict center, universal mutation registry, offline replay melalui service worker, context cache, performance indexes, animation system, animated dashboard numbers, proactive insight, quick capture global, sync status header, optimistic task mutations, dan preference language.

Housekeeping sync history dapat dijalankan secara terjadwal menggunakan:

```bash
npm run sync:prune
```

Jangan jalankan prune lebih sering daripada kebutuhan. Default retention adalah 90 hari dengan batas aman 30–365 hari.

### V32.1 — Experience & reliability patch

Pastikan file release terbaru juga sudah membawa:

- `lib/sync/client.ts` untuk mutation terpusat pada domain utama.
- `components/layout/SyncStatusBadge.tsx` untuk status sync ringkas.
- `components/intelligence/ProactiveInsight.tsx` dan `/api/proactive/evaluate`.
- `components/ui/AnimatedNumber.tsx`.

Setelah deploy:

```bash
npm run verify:v32
npm run verify
npm run test
npm run audit
npm run build
```
