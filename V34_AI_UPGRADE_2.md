# Licia V34 — AI Upgrade 2

Perubahan utama:
- CRUD eksplisit untuk notification history: read, mark read, delete one, delete all.
- Tool routing menambahkan domain notifikasi.
- Aksi massal `delete_all_notifications` masuk review ketika proteksi massal aktif.
- Batch AI menyimpan hasil parsial di `execution_result` dan menutup lifecycle dengan `status=applied` agar kompatibel dengan trigger database lama.
- Tes Web Push sekarang mengembalikan alasan konkret ketika belum ada subscription atau delivery gagal.
- Notification API mendukung DELETE satu/semua.
- Prompt AI diperkuat untuk workflow READ → VERIFY → CRUD → VERIFY dan ekstraksi jadwal dari gambar.
- Guide diperluas dengan panduan AI CRUD, gambar-jadwal, batch review, sync/conflict, push troubleshooting, dan settings V34.

Migration tambahan: `supabase/schema_v34_1_ai_execution.sql`.
