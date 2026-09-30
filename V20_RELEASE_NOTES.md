# Licia V20 — Deployment Release

V20 diposisikan sebagai release stabilisasi dan deployment production. Fitur aplikasi inti dipertahankan.

## Perubahan

- Menambahkan `npm run preflight` dan `prebuild` untuk memeriksa Node.js, environment production, origin, serta file deployment wajib.
- Memastikan `NEXT_PUBLIC_SITE_URL` dan `APP_URL` konsisten di production; HTTPS direkomendasikan, tetapi HTTP via IP publik VPS didukung untuk deployment tanpa domain.
- Menolak konfigurasi `DEV_TUNNEL_ORIGIN` yang terbawa ke production.
- Next.js production dijalankan PM2 hanya pada `127.0.0.1:3000`; port aplikasi tidak perlu diekspos langsung ke internet.
- PM2 mendapatkan restart/backoff policy yang lebih aman untuk VPS kecil.
- Nginx meneruskan `X-Forwarded-Host` dan `X-Forwarded-Port`, mengizinkan payload chat bergambar sampai sekitar 12 MB, dan memberi timeout proxy 120 detik untuk request AI.
- HSTS hanya dikirim saat production sehingga development/Forward Port tidak dipaksa HTTPS oleh browser.
- Service worker memakai cache key `licia-v20-shell` agar cache V18 lama langsung dibuang.
- Endpoint health tetap tidak pernah mengembalikan secret.
- `.gitignore` diperketat agar `.env`, `.env.local`, `.env.production`, dan environment nyata lain tidak ikut ter-commit; file `.env*.example` tetap boleh disimpan.

## Deployment

```bash
npm install
npm run preflight
npm run verify
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Tes lokal di VPS:

```bash
curl http://127.0.0.1:3000/api/health
npm run health
```

Tes akses publik untuk deployment IP-only:

```text
http://IP-VPS-KAMU/api/health
http://IP-VPS-KAMU/chat
```

Jika suatu hari domain + HTTPS ditambahkan, ganti URL sesuai domain tersebut.

## Catatan dependency

V20 tidak memaksa pembuatan `package-lock.json` karena environment pengembangan sebelumnya gagal menyelesaikan akses npm. Setelah dependency sudah stabil di mesin/VPS, simpan lockfile sebagai bagian source release dan gunakan `npm ci` untuk deployment berikutnya.

- Memperbaiki `preflight` agar memuat file `.env` yang sama dengan runtime Next.js; `npm run preflight` dan `npm run build` kini membaca `.env.local`/`.env.production*` sebelum validasi.


## Final clean release hardening
- Production IP-only mode supports `http://IP-VPS` without requiring a domain or HTTPS.
- Nginx template uses `server_name _;` for direct IP deployments.
- HSTS is emitted only when the configured public origin uses HTTPS.
- Added `next-env.d.ts` for deterministic Next.js TypeScript editor/build typing.
- Verification checks regressions for font preset fields, task `completed_at`, profile timezone selection, stale files, and packaged secret env files.
- Release should be extracted into a clean directory; do not overlay an older Licia installation.


## Final audit performed
- 89 source files TS/TSX diparse tanpa syntax error.
- 175 local imports diperiksa; tidak ada import lokal yang hilang.
- 13 API route diperiksa; seluruh route mutating memiliki same-origin guard.
- 4 route OpenAI diperiksa; seluruhnya menggunakan Node.js runtime dan tidak ada direct browser call ke OpenAI.
- Tidak ada wildcard CORS dan tidak ada secret OpenAI yang dipaketkan.
- Konfigurasi Nginx diuji dengan `nginx -t`.
- Konfigurasi PM2 diuji dan Next.js dibatasi ke `127.0.0.1:3000`.
- Mode production HTTP via IP diuji oleh preflight.
- Full `next build` tidak dijalankan di lingkungan audit karena dependency npm tidak dapat di-install sampai selesai; verifikasi akhir build tetap harus dilakukan di VPS setelah `npm install`.

## V20 build-safe v6
- Fixed nullable RawMsg content narrowing in `components/chat/ChatWidget.tsx` by reusing the narrowed `parts` array after `Array.isArray(clean.content)`.
- Rechecked `.content` array operations and `.push()` sites for the same class of TypeScript null/never inference issues.

### Build fix v8 — AI context PromiseLike handling
- Fixed `lib/ai/context.ts` so Supabase query builders are passed directly to `Promise.all()` instead of an `Array<Promise>` that rejects Supabase `PromiseLike` builders during TypeScript checking.
- Scanned the source for the same `jobs.push(...)` / `Promise.all(jobs)` pattern; no other occurrences remain.

# V20 polish notes
# Licia V20 — Polish & Modern UX Patch

Perbaikan ini mempertahankan fitur V20 yang sudah ada dan berfokus pada stabilitas runtime, mobile responsiveness, Forward Port, dan satu enhancement UX ringan.

## Fixes
- Forward Port development: menerima browser origin loopback (`localhost`, `127.0.0.1`, `::1`) secara development-only sehingga `http://localhost:3000` tidak lagi ditolak ketika API diteruskan oleh `*.devtunnels.ms`.
- PWA/service worker: navigation selalu mencoba halaman Next.js secara network-first; `/offline.html` hanya dipakai ketika jaringan benar-benar gagal. Cache shell dinaikkan versinya dan service worker dipaksa update.
- Mobile: mencegah child flex/grid dan teks panjang memperlebar viewport; overflow horizontal yang memang disengaja tetap dapat digeser.
- Command Center: `Ctrl/Cmd + K` membuka Quick Search, dan awalan `>` mengaktifkan mode perintah untuk navigasi cepat.

## Tidak berubah
- Tidak ada perubahan schema database.
- Tidak ada perubahan alur fitur inti.
- OpenAI tetap dipanggil server-side.
- Proteksi same-origin tetap aktif di production.
