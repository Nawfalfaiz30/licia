# Licia V20 — Deployment VPS Ubuntu (IP-only)

Licia V20 dapat dijalankan 24/7 tanpa domain. Untuk deployment ini, gunakan IP publik VPS sebagai origin dan Nginx sebagai reverse proxy di depan Next.js. Domain/HTTPS bersifat opsional dan dapat ditambahkan kemudian.

## 1. Requirement
- Ubuntu 22.04/24.04
- Node.js 22 LTS
- npm 10+
- PM2
- Nginx
- Supabase production project
- IP publik VPS

## 2. Deploy ke folder bersih
Jangan mengekstrak V20 di atas folder Licia lama karena file stale dari versi sebelumnya dapat tetap tertinggal dan kembali memunculkan error TypeScript.

```bash
cd /root
mv licia licia-backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
mkdir -p licia
unzip licia-v20-final-ip-only-clean.zip -d licia
cd licia
```

Jika arsip sudah berisi source langsung di root ZIP, `package.json` harus berada di `/root/licia/package.json`.

## 3. Environment
Buat `.env.local` di VPS. Jangan masukkan secret ke Git atau ZIP.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY=YOUR_OPENAI_KEY

NEXT_PUBLIC_SITE_URL=http://YOUR_VPS_PUBLIC_IP
APP_URL=http://YOUR_VPS_PUBLIC_IP
DEV_TUNNEL_ORIGIN=
```

`NEXT_PUBLIC_SITE_URL` dan `APP_URL` harus identik dan berupa origin tanpa path. HTTP diperbolehkan untuk deployment IP-only. Preflight akan memberi warning karena PWA/service worker dan browser notification membutuhkan secure context/HTTPS di browser modern.

## 4. Install + preflight

```bash
npm install
npm run preflight
npm run verify
```

Jika `preflight` menampilkan `Environment loaded from: .env.local`, berarti file environment berhasil dibaca oleh script preflight.

## 5. Build production
Pada VPS 1 GB, siapkan swap minimal 2 GB sebelum build.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

Lalu:

```bash
npm run build
```

`prebuild` akan menjalankan preflight lebih dulu. Jangan menambal error TypeScript di VPS satu per satu; gunakan arsip V20 final pada folder bersih.

## 6. PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Jalankan command `sudo ...` yang dicetak oleh pm2 startup.
pm2 save
```

Next.js hanya listen di `127.0.0.1:3000`, sehingga port 3000 tidak perlu dibuka ke internet.

## 7. Nginx — IP-only

Salin konfigurasi:

```bash
sudo cp deploy/nginx-licia.conf /etc/nginx/sites-available/licia
sudo ln -sf /etc/nginx/sites-available/licia /etc/nginx/sites-enabled/licia
sudo nginx -t
sudo systemctl reload nginx
```

Konfigurasi V20 menggunakan `server_name _;`, sehingga langsung dapat melayani akses via IP publik. Jika VPS memiliki situs lain, review virtual host yang ada sebelum menjadikannya default.

Akses:

```text
http://IP-VPS-KAMU
```

## 8. Healthcheck
Tes dari VPS:

```bash
curl http://127.0.0.1:3000/api/health
curl http://IP-VPS-KAMU/api/health
```

Pastikan response menunjukkan aplikasi hidup dan konfigurasi Supabase/OpenAI terdeteksi. Secret tidak pernah dikembalikan oleh endpoint health.

## 9. Security / origin
`enforceSameOrigin()` tetap aktif. Production mengizinkan origin yang sama dengan `NEXT_PUBLIC_SITE_URL`/`APP_URL`; origin asing tetap ditolak. Dukungan loopback dan Dev Tunnel hanya untuk development.

## 10. PWA / HTTPS
Tanpa domain dan tanpa HTTPS, aplikasi utama tetap dapat diakses melalui IP. Namun service worker/PWA installability dan browser notification dapat dibatasi oleh secure-context policy browser. Ini bukan blocker untuk penggunaan web 24/7.

Jika suatu hari domain + HTTPS ditambahkan, cukup ubah:

```env
NEXT_PUBLIC_SITE_URL=https://domain-kamu
APP_URL=https://domain-kamu
```

dan sesuaikan `server_name` Nginx.


## Licia V29 — Notifikasi & Reminder 24/7

Setelah source terbaru dipasang, jalankan sekali dari folder Licia:

```bash
npm install
npm run preflight
npm run verify
npm run build
```

`web-push` adalah dependency runtime server. Jika source sudah diperbarui tetapi `node_modules` masih berasal dari versi sebelum V28, `npm run build` akan gagal dengan `Can't resolve 'web-push'`. Jangan menambahkan library secara manual ke source; cukup jalankan `npm install`.

Untuk Web Push, buat VAPID key di VPS setelah `web-push` terpasang:

```bash
npx web-push generate-vapid-keys
```

Isi `.env.local` di VPS dengan:

```env
VAPID_SUBJECT=mailto:admin@domain-kamu
VAPID_PUBLIC_KEY=PUBLIC_KEY_DARI_COMMAND
VAPID_PRIVATE_KEY=PRIVATE_KEY_DARI_COMMAND
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
LICIA_CRON_SECRET=random-secret-panjang
```

`NEXT_PUBLIC_SITE_URL` dan `APP_URL` harus menunjuk ke origin HTTPS production agar PWA dan Web Push dapat digunakan browser.

### Reminder 24/7 dengan cron

Agar reminder tetap diproses ketika tidak ada tab Licia yang terbuka, cron VPS memanggil endpoint dispatch setiap menit. Source sudah menyediakan helper:

```bash
cd /root/licia
node scripts/reminder-cron.mjs
```

Tambahkan ke `crontab -e`:

```cron
* * * * * cd /root/licia && /usr/bin/node scripts/reminder-cron.mjs >> /var/log/licia-reminder.log 2>&1
```

Mode ketika tab Licia terbuka juga tetap aktif: Notification Center melakukan polling ringan dan membuat event notifikasi. Jadi pengingat tidak sepenuhnya bergantung pada Web Push. Web Push + cron diperlukan untuk notifikasi ketika aplikasi/browser tidak sedang terbuka.

### Tes setelah deploy

1. Buka `/system`.
2. Klik **Tes browser**.
3. Klik **Reminder 1 menit**.
4. Klik **Jalankan reminder** setelah waktunya lewat.
5. Setelah push aktif, buka Settings → Experience → aktifkan push pada perangkat lalu gunakan **Kirim tes push**.

### Reminder worker via PM2 (direkomendasikan)

Source terbaru menyediakan `licia-reminder-worker` di `ecosystem.config.cjs`. Worker ini memanggil dispatch reminder setiap 60 detik menggunakan `LICIA_CRON_SECRET`, sehingga tidak bergantung pada crontab OS.

Setelah `.env.local` berisi `APP_URL`/`NEXT_PUBLIC_SITE_URL` dan `LICIA_CRON_SECRET`, jalankan:

```bash
npm install
npm run build
```

Untuk deployment PM2, gunakan langsung:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Periksa:

```bash
pm2 status
pm2 logs licia-reminder-worker --lines 50
```

Crontab `scripts/reminder-cron.mjs` tetap tersedia sebagai alternatif. Gunakan salah satu mekanisme scheduler, tidak perlu keduanya.
