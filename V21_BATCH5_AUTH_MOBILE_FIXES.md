# Licia V21 — Batch 5 Auth + Mobile Fixes

Baseline: `licia-v20-polish-release.zip`

## Perbaikan

- Memperbaiki error TypeScript di `components/dashboard/QuickCapture.tsx` tanpa casting palsu ke `PostgrestResponseFailure`.
- Signup email/password sekarang mengirim `emailRedirectTo` ke origin yang sedang dipakai browser (`/auth/callback`), sehingga tidak bergantung pada URL default Supabase untuk confirmation.
- OAuth callback pada production memakai `NEXT_PUBLIC_SITE_URL` / `APP_URL` yang sudah divalidasi sebagai public origin; development tetap mengikuti origin request lokal.
- Production preflight sekarang menolak `NEXT_PUBLIC_SITE_URL` atau `APP_URL` yang menunjuk ke localhost/loopback.
- Judul section dan action dibuat dapat membungkus di layar sempit.
- Nilai/hint StatTile tidak lagi dipotong dengan `truncate`.
- Notification panel pada mobile dipindahkan menjadi viewport-fixed agar tidak keluar layar.
- Bottom navigation menghormati safe-area perangkat.
- More Sheet memakai tiga kolom pada mobile agar label lebih lapang.
- Global mobile hardening: konten/flex/grid menjaga `min-width: 0`, media tidak melampaui viewport, input/button tidak melebar, dan kode/preformatted text dapat membungkus/scroll dengan aman.
- Grid 3–6 kolom pada layar <= 420px diturunkan menjadi dua kolom; pada <= 360px menjadi satu kolom untuk mencegah kartu/stat terlalu sempit.

## Audit localhost

Tidak ditemukan referensi runtime `localhost:3000` pada komponen aplikasi, manifest, service worker, atau route auth. Referensi yang tersisa berada pada dokumentasi serta komentar development-only.

Untuk production Supabase Auth, URL Configuration tetap harus memakai:

- Site URL: `https://licia.site`
- Redirect URL: `https://licia.site/auth/callback`
- Bila local development juga dipakai: `http://localhost:3000/**`

## Validasi lokal

- 101 file TypeScript/TSX/JS berhasil diparse tanpa syntax error.
- Build Next.js penuh belum dijalankan dalam environment paket ini karena `node_modules` tidak disertakan dan registry dependency sebelumnya mengalami timeout. Jalankan di mesin development:

```powershell
npm install
npm run preflight:dev
npm run preflight
npm run verify
npm run build
```
