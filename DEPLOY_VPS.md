# Licia V30 — Deployment VPS Ubuntu

Licia V30 adalah baseline production baru setelah upgrade dari V29. Stack utama:

- Next.js 16.x + React 19.x
- Supabase + RLS
- OpenAI tool-calling + AI model router
- Reminder Engine V30 + server heartbeat
- Web Push + PWA
- PM2 + Nginx

V30 tetap cocok untuk VPS Ubuntu dengan Node 22. Jangan menyalin source V30 ke folder lama. Gunakan folder deploy bersih agar file stale tidak tertinggal.

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
unzip licia-v30.zip -d licia
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

## 4. Database migration V30

Jalankan **sekali** di Supabase SQL Editor:

```text
supabase/schema_v30_core_intelligence.sql
```

File ini idempotent untuk objek V30. Untuk instalasi database dari nol, gunakan:

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

V30 memakai Node 22 dan build script dengan memory guard:

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
- V30 schema
- AI usage telemetry

Crontab OS tetap tersedia sebagai fallback, tetapi **jangan aktifkan PM2 worker dan crontab bersamaan**, karena keduanya dapat memanggil dispatcher yang sama.

## 11. Healthcheck

```bash
curl http://127.0.0.1:3000/api/health
curl https://licia.example.com/api/health
```

Secret tidak pernah ditampilkan oleh health endpoint.

## 12. Update release berikutnya

Backup folder lama lalu deploy V30 ke folder bersih:

```bash
cd /root
mv licia licia-backup-$(date +%Y%m%d-%H%M%S)
mkdir licia
unzip licia-v30.zip -d licia
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
```

kemudian `/system` → `Segarkan`.

### PWA/push tidak aktif

Pastikan production dibuka melalui HTTPS dan service worker sudah aktif. IP-only HTTP tidak menjamin secure context untuk semua kemampuan browser.
