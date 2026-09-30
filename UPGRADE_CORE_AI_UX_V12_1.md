# Licia v12.1 — Core, AI & UX Upgrade

## Fokus perubahan
- Relations retired dari produk; diganti Life Map.
- Smart Inbox: batch triage, filter/search, convert ke task/note/idea/decision/learning.
- Chat: hapus pesan per turn di mobile/desktop, clear chat, pending delete confirmation yang ringan.
- Memory/Vault/Automation: fungsi dijelaskan dan dihubungkan ke AI secara selektif.
- Chat Licia dapat create/update/delete item Vault dan aturan Automation dengan konfirmasi untuk aksi destruktif.
- Finance, Focus, Subscriptions, Projects, Goals, Calendar, Brief/Review, Timeline, Analytics, Health, Settings dirombak untuk mobile-first.
- AI Weekly Planner dapat dihapus per minggu.
- Legacy `/review` → `/brief`, `/relations` → `/life-map`, `/pomodoro` → `/focus`.

## Prinsip AI
- Domain routing: hanya domain yang relevan dimasukkan ke konteks.
- Operation routing: tool `delete_*`, `update_*`, `create_*`, `log_*` dipilih berdasarkan operasi yang diminta.
- History: hanya beberapa turn terakhir.
- Tool results: array/string besar dipadatkan sebelum dikirim kembali ke model.
- Model utama: `gpt-4o-mini`, output dibatasi sesuai tugas.
- Data lintas-modul dipakai sebagai snapshot ringkas; detail diambil lewat tool saat diperlukan.

## Supabase
Setelah database existing tersedia, jalankan `supabase/schema_phase11_modern_os.sql` setelah `supabase/schema_all.sql`. Migrasi idempotent dan tidak menghapus tabel Relations lama.

## Verifikasi
- Semua 66 file `.ts/.tsx` berhasil diparse dengan TypeScript tanpa syntax failure.
- Semua 33 tabel yang dipanggil `.from()` ditemukan di `schema_all.sql`.
- Tidak ditemukan missing table pada audit route.
- Status Smart Inbox diselaraskan ke schema: `open / processed / archived`.
- Full `next build` belum dapat dijalankan di environment kerja karena dependency npm belum terpasang; jalankan `npm install` lalu `npm run build` pada mesin pengembangan/VPS.
