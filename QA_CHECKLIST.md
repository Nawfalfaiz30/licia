# Lisia — QA / Release Checklist

## Static checks
- Semua TS/TSX diparse dengan TypeScript compiler.
- Tidak ada file baseline yang hilang dari v12.2.
- `npm run build` wajib dijalankan setelah dependency terpasang.
- Review RLS Supabase sebelum production.

## User flows
- Login/logout/session
- Smart Inbox → Tugas/Catatan/Keputusan
- Tugas → Proyek/Target/Kalender/Fokus
- Kalender → detail agenda
- Fokus → pencatatan sesi → tugas/proyek/analitik
- Finance → transaksi/anggaran/dompet/langganan
- Health → air/makanan/kafein/obat
- AI → baca gambar → tool → konfirmasi hapus
- Settings → preference runtime
- PWA → install/offline shell

## Production
- `.env.local` terisi secrets production dan tidak di-commit.
- HTTPS aktif sebelum Browser Notifications/PWA production.
- `GET /api/health` mengembalikan `ok:true`.
- PM2 autorestart aktif.
- Nginx `nginx -t` berhasil.
