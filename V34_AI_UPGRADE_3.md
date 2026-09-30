# Licia V34 — AI Upgrade 3

## Fokus

AI V34 diperkuat untuk mengatasi tiga masalah utama: aksi notification history yang sebelumnya tidak dapat dilakukan, batch AI yang tersandung transition database `pending -> applied_with_errors`, dan akses AI lintas Life OS yang belum benar-benar membuka seluruh tool baca ketika `Akses seluruh data Life OS` aktif.

## Perubahan

### AI lintas Life OS
- Saat `aiReadAllData` aktif, semua tool baca lintas domain diekspos melalui `selectReadToolDefs`.
- Tool write tetap dirouting berdasarkan intent agar permintaan baca biasa tidak membawa seluruh write surface.
- `manage_life_os_data` tetap tersedia untuk entity yang belum memiliki tool domain khusus dan dibatasi allowlist field/entity.

### Riwayat notifikasi
- `get_notifications`
- `mark_notification_read`
- `delete_notification`
- `delete_all_notifications`

Penghapusan seluruh riwayat menggunakan konfirmasi eksplisit `confirm=true`. Tool ini sengaja tidak dibungkus ke `ai_pending_actions`, sehingga konfirmasi percakapan tidak berubah menjadi batch replay `confirm=false`.

### Gambar jadwal
Preprocessor vision sekarang memberi instruksi khusus untuk:
- membaca setiap baris/kartu secara terpisah,
- mempertahankan hari/tanggal/jam mulai/jam selesai,
- membaca judul, lokasi, dosen/catatan,
- tidak menebak tanggal/tahun yang tidak terlihat.

### Batch AI
Batch tetap menyimpan `status='applied'` agar kompatibel dengan trigger database lama. Status semantik `completed`, `partial`, dan `failed` disimpan pada `execution_result`, `completed_actions`, `failed_actions`, dan `error_summary`.

### Web Push
- Pendaftaran browser hanya membutuhkan public VAPID key.
- Service-role dibutuhkan untuk pengiriman server.
- `LICIA_CRON_SECRET` hanya diperlukan untuk worker/dispatcher reminder.
- Test push sekarang membedakan `PUSH_SERVER_NOT_READY`, `NO_PUSH_SUBSCRIPTION`, dan `PUSH_DELIVERY_FAILED`.

### Guide
Guide diperluas dengan:
- AI CRUD
- workflow gambar jadwal
- manajemen notification history
- review batch
- conflict resolver
- Web Push troubleshooting
- Settings V34
- troubleshooting aksi AI
- checklist pemeriksaan V34
- build & deployment

## Verifikasi

```text
node scripts/test-v34-ai3.mjs   ✅
node scripts/test-v34-ai2.mjs   ✅
node scripts/verify-v34.mjs     ✅
node scripts/test-v34.mjs       ✅
151 TS/TSX parsed, 0 syntax errors
```

Production `typecheck/build` tetap harus dijalankan pada environment dengan dependency ter-install menggunakan `npm ci`.
