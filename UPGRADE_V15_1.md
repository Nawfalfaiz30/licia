# Licia v15.1 — UI, Settings & Intelligence Refinement

## Baseline
Built from `licia-v14-ux-refined.zip` and preserves all baseline files/features.

## Perubahan utama
- Header Tanya Licia dipadatkan agar composer cepat terlihat tanpa scroll panjang.
- Header desktop/mobile dirapikan; Tanya Licia tetap menuju `/chat`.
- Quick Search kecil dikembalikan di samping Notifikasi.
- Notification Center dibuat lebih opaque, kontras, terstruktur, dan interval refresh mengikuti Pengaturan.
- Kepadatan UI kini benar-benar memengaruhi padding card/stat, jarak section, gap grid, tinggi kontrol, dan radius hero.
- Pengaturan diperluas: mode AI default, gaya respons AI, jarak peringatan, interval notifikasi, konfirmasi aksi massal, reset tampilan, task/calendar defaults, chat style, text scale, motion, dan lain-lain.
- Mode bahasa dikunci ke Bahasa Indonesia agar tidak ada campuran label Inggris yang belum diterjemahkan.
- Smart Suggestions sekarang menghormati toggle Pengaturan.
- Jarak deadline/project/goal/subscription di Intelligence mengikuti `notificationLeadDays`.
- AI response style diteruskan ke system prompt.
- Search API + halaman pencarian lintas Tugas/Proyek/Target/Catatan/Inbox dipertahankan.
- Semua fungsi v14 tetap ada; tidak ada file baseline yang dihapus.

## Validasi
- 77 file TS/TSX diparse dengan TypeScript: 0 syntax error.
- Regression diff terhadap v14: 0 file hilang; 4 file baru terkait search/Quick Search.
- Tidak ditemukan sisa Command Palette/Ctrl+K.
- Tidak ada artefak `.tsbuildinfo`, `.log`, atau `.DS_Store`.
- `npm install` / `next build` belum dapat diverifikasi di environment audit karena registry dependency timeout.

## Catatan production
Sebelum deploy ke VPS jalankan:

```bash
npm install
npm run build
pm start
```

Setelah build lulus, gunakan PM2 + Nginx sesuai `DEPLOY_VPS.md`.
