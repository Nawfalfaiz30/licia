# Licia V32 — Sync, Intelligence & Experience Upgrade

## Yang berubah

### Sync Core
- Mutation idempotency server-authoritative.
- Device registry dan sync cursor.
- Event stream + Realtime invalidation.
- Offline mutation queue dengan Background Sync service worker.
- Conflict Center untuk memilih versi server/perangkat atau membuang konflik.
- Row versioning pada domain utama dan domain tambahan.
- Sinkronisasi sekarang mencakup task, agenda, project, goal, note, Inbox, reminder, memory, subtask, milestone, decision, skill, finance, health, focus, reading, dan relationship records.

### Performance
- Context cache TTL pendek untuk mengurangi query AI berulang.
- Cache di-invalidasi setelah mutation server berhasil.
- Index database V32 untuk updated_at, sync events, mutations, finance, health, dan check-in.
- Sync refresh di-debounce dan manual sync tersedia.

### Experience
- Animation system V32: page entrance, bottom sheet, success bloom, sync pulse, skeleton, ripple, responsive interaction.
- Animated numbers untuk ringkasan dashboard.
- Haptic feedback pada navigasi dan tombol penting.
- Sync status terlihat di header dan pusat sinkronisasi.
- Proactive Insight: Licia menyoroti tugas terlambat, hari yang padat, target yang mendekati tenggat, dan Inbox yang menumpuk.
- Global Quick Capture dari desktop/mobile.
- Tetap menghormati `prefers-reduced-motion`, Reduced Motion, dan mode animasi pengguna.

### Settings
- Bahasa inti dapat dipilih Indonesia/English.
- Pengaturan sync, conflict, PWA, proactive assistant, planner, animation, haptic, Enter-to-send, dan Quick Capture tersimpan bersama preference akun.
- Copy UI dibuat lebih natural dan konsisten, termasuk `Ruang kerja & nilai bawaan` dan `Kesehatan harian`.
- Perilaku Enter benar-benar mengikuti preference: Enter untuk kirim atau Enter untuk baris baru.

## Migration
1. Jalankan `supabase/schema_v31_sync.sql`.
2. Jalankan `supabase/schema_v32_sync_experience.sql`.
3. `npm ci` pada VPS.
4. Jalankan `npm run verify:v32`.
5. Build production dengan `npm run build`.
6. Aktifkan worker reminder seperti biasa.
7. Untuk housekeeping berkala, gunakan `npm run sync:prune` dari scheduler terpercaya.

> Jangan pernah memasukkan `.env.local` atau `SUPABASE_SERVICE_ROLE_KEY` ke ZIP, Git, atau dokumentasi publik.

### Performance & reliability tambahan
- Search API memiliki cache server-side TTL pendek yang aman per user/query untuk mengurangi query berulang saat mengetik cepat.
- Mutation client mengutamakan offline queue dan memakai optimistic state pada task utama.
- Conflict resolver menyediakan `Gabungkan aman`, yang mempertahankan nilai server pada field yang benar-benar bertabrakan dan membawa perubahan yang hanya muncul di salah satu sisi.
- Service worker dapat mengeksekusi replay offline dengan lifetime event yang ditahan sampai proses selesai.
- V32 juga memperkuat gate origin development untuk localhost + VS Code Dev Tunnel.
