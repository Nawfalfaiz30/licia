# DEPLOY_VPS — Licia 2.0

## 1. Persiapan server

Gunakan Node.js 22.x dan npm 10+ sesuai `package.json`.

```bash
cd /path/ke/licia
npm ci
npm test
npm run build
```

Jalankan dengan PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

`ecosystem.config.cjs` menjalankan dua proses: web Licia dan reminder worker.

## 2. Environment

Set environment produksi pada shell/PM2:

```env
NODE_ENV=production
PORT=3000

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

OPENAI_API_KEY=...

VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com

LICIA_AI_MODEL=...
LICIA_AI_HEAVY_MODEL=...
LICIA_AI_TOOL_MODEL=...

LICIA_CRON_SECRET=...
LICIA_URL=https://domain-kamu
NEXT_PUBLIC_SITE_URL=https://domain-kamu
```

`LICIA_AI_HEAVY_MODEL` dan `LICIA_AI_TOOL_MODEL` bersifat opsional. `LICIA_AI_TOOL_MODEL` berguna ketika model utama tidak cocok untuk function tools.

Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di kode browser atau variabel `NEXT_PUBLIC_*`.

## 3. Migration Supabase

Jalankan migration SQL sesuai urutan yang sudah dipakai proyek.

Untuk riwayat chat server-side, jalankan:

```text
supabase/schema_ai_chat_history.sql
```

Untuk pending action, pastikan migration `schema_v35_1_1_ai_pending_transition.sql` juga sudah dijalankan pada database yang masih membawa trigger lama.

## 4. Web Push dan reminder

Pastikan VAPID terisi. Worker reminder dijalankan oleh PM2:

```bash
pm2 logs licia-reminder-worker
```

Interval worker dapat diatur:

```env
LICIA_REMINDER_WORKER_INTERVAL_MS=60000
```

## 5. Reverse proxy

Arahkan reverse proxy HTTPS ke:

```text
http://127.0.0.1:3000
```

Pastikan origin domain produksi sesuai `LICIA_URL`, `NEXT_PUBLIC_SITE_URL`, atau konfigurasi origin yang digunakan `lib/security.ts`.

## 6. Setelah update source

```bash
git pull
npm ci
npm test
npm run build
pm2 reload ecosystem.config.cjs
pm2 save
```

Cek:

```bash
pm2 status
pm2 logs licia --lines 100
pm2 logs licia-reminder-worker --lines 100
```

## 7. Catatan troubleshooting

Jika chat gagal dengan error konfigurasi OpenAI, cek `OPENAI_API_KEY`.

Jika function tools ditolak oleh model tertentu, arahkan tool-call path ke model yang kompatibel melalui:

```env
LICIA_AI_TOOL_MODEL=nama-model-yang-kompatibel
```

Jika chat kembali kosong setelah deploy, periksa cookies/session Supabase dan origin HTTPS.

Jika riwayat lintas perangkat belum muncul, periksa apakah `supabase/schema_ai_chat_history.sql` sudah diterapkan dan PostgREST sudah melihat tabel baru.

## AI generation compatibility

Recommended production settings:

```env
LICIA_AI_OMIT_TEMPERATURE=true
LICIA_AI_REASONING_EFFORT=none
```

The server also retries one time without a rejected generation parameter when OpenAI returns HTTP 400, so changing AI models does not require hardcoding their names in source code.

## Reminder reliability

```env
LICIA_REMINDER_MAX_DELIVERY_ATTEMPTS=5
LICIA_REMINDER_MAX_OVERDUE_MS=86400000
```
