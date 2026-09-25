# Licia v18 — Stabilization & Integration Fixes

Baseline: Licia v17

## Perubahan utama
- Membersihkan Markdown mentah pada feed dashboard, pencarian, Inbox, Today, Brief, Vault, Finance, Subscriptions, Reading, dan Timeline menggunakan `lib/text.ts`.
- Memperbaiki same-origin guard agar kompatibel dengan `Host`/`X-Forwarded-Host`/`X-Forwarded-Proto` dan URL publik `NEXT_PUBLIC_SITE_URL` / `APP_URL`, tanpa mematikan proteksi CSRF.
- Merombak Pusat Insight: workload score, risiko proyek, hari fokus, perubahan pengeluaran, radar sinyal, refresh manual, dan insight yang lebih terstruktur.
- Timeline: detail sekarang inline di lokasi event yang diklik (tidak lagi fixed drawer/bottom sheet yang terasa berpindah ke atas).
- Focus: pause/resume sekarang mempertahankan sisa waktu dan status pause disimpan di localStorage. Interval timer diturunkan dari 250ms ke 1000ms untuk mengurangi render.
- Animasi: menambahkan refined reveal/hover/ambient motion yang lebih lembut dan terbatas pada area penting.
- Dashboard: typo UI diperbaiki dan feed aktivitas menggunakan teks bersih.
- Template `.env.production.example` diperbarui untuk konfigurasi public origin.

## Validasi
- `npm run verify` berhasil.
- 89 file TS/TSX, 0 syntax error.
- 35 tabel Supabase yang direferensikan source semuanya ada di schema.
- Tidak ada `CommandPalette` / `Ctrl+K` residual.

## Production note
`npm install`/`npm build` belum dapat diverifikasi penuh di environment audit karena registry dependency timeout. Jalankan di VPS:

```bash
npm install
npm run verify
npm run build
npm start
```

Untuk deployment di balik Nginx/Cloudflare, set:
- `NEXT_PUBLIC_SITE_URL=https://domain-anda`
- `APP_URL=https://domain-anda`
