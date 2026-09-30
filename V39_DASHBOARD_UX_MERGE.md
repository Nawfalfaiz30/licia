# Licia v0.39.0 — Dashboard, Agenda & Target/Proyek Consolidation

## Perubahan utama

- Memperbaiki halaman **Hari Ini** agar hanya memuat `schedule_blocks` dengan `block_date` yang sama persis dengan tanggal lokal pengguna.
- Dashboard tidak lagi menampilkan **Life Copilot**, **AI Mode Guide**, atau **Rencana tindakan Licia** di area atas.
- Area setelah sapaan kini berisi informasi cepat: **jadwal hari ini, keuangan, target & proyek, dan kondisi kesehatan**.
- Sapaan pagi/siang/malam memakai variasi yang dipilih secara deterministik berdasarkan tanggal/jam sehingga tidak terasa monoton tanpa berubah acak setiap render.
- **Target** dan **Proyek** digabung menjadi satu workspace `/goals-projects`.
- Menu Target dan Proyek yang terpisah di navigasi dihapus. Route lama tetap aman melalui redirect ke workspace gabungan.
- Workspace Target & Proyek kini menyediakan pembuatan target/proyek, pencarian gabungan, progres target, hubungan target→proyek, task cepat proyek, fokus, status proyek, dan arsip.
- Panel notifikasi dibuat **opaque/solid** agar konten dashboard di belakang tidak menembus panel.
- Tambahan regression test & verifier V39.

## Build

Jalankan `npm ci`, lalu `npm test`, `npm run verify`, `npm run typecheck`, dan `npm run build`.
