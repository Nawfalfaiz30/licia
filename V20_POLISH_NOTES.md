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
