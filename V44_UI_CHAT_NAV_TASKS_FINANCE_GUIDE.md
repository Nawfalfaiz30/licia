# Licia — Consolidated UX & Action Upgrade

## Perubahan utama

### Chat Licia
- Tampilan percakapan dibuat lebih tenang dan fokus pada pesan.
- Metadata pesan tidak ditampilkan pada layar ponsel agar bubble tidak menumpuk.
- Ringkasan aksi tidak lagi tampil sebagai panel besar yang mengambil ruang percakapan.
- Konfirmasi perubahan massal hanya memakai action strip kecil dengan Terapkan/Tolak.
- Undo aksi terakhir memakai strip ringkas yang tidak mengganggu composer.
- Header, menu, composer, dan avatar dibuat lebih konsisten untuk desktop dan mobile.

### Navigasi
- Footer mobile menggunakan **Lainnya**, bukan Wawasan.
- Lainnya menampilkan workspace aktif dan subfitur yang masih tersedia.
- Fitur lama yang sudah digabung tidak muncul kembali sebagai duplikat.
- Desktop memakai struktur canonical yang sama dengan mobile.
- Peta Hidup, Peta Koneksi, Linimasa, Analitik, Review, dan Otomasi diperlakukan sebagai bagian dari Insights.

### Rencana dan Tugas
- Prioritas dengan Licia dikerjakan langsung dari halaman Tugas.
- Agenda → Tugas membuat task dan menghubungkannya ke agenda.
- Tugas → Agenda mencari slot kosong dan membuat agenda terhubung.
- Perencana Mingguan, Inbox, dan Pengingat berada sebagai subfitur dalam alur Rencana.
- Tidak ada tombol aksi tugas yang mengalihkan pengguna ke Chat hanya untuk menjalankan aksi terstruktur.

### Keuangan
- Langganan sepenuhnya berada di dalam Keuangan.
- Ringkasan menampilkan komitmen rutin dan tagihan terdekat.
- Langganan dapat ditambahkan, dinonaktifkan, dihapus, dibuka URL layanannya, dan dicatat pembayarannya menjadi transaksi pengeluaran.
- Ringkasan Keuangan menggabungkan transaksi, anggaran, dompet, dan komitmen rutin.

### Panduan dan Pengaturan
- Panduan mengikuti struktur workspace yang sedang dipakai aplikasi.
- Tidak ada penyebutan milestone internal atau label versi di Panduan/Pengaturan.
- Pengaturan menyediakan bagian Workspace agar pengguna memahami hubungan antara Beranda, Rencana, Chat, Tangkap, Insights, dan Ruang Hidup.
- Halaman awal lama dinormalisasi ke workspace baru.
- Pengaturan AI mengikuti kelompok data yang sama dengan workspace gabungan.

### Konsolidasi tambahan
- Command Palette desktop memakai workspace canonical, bukan menu lama.
- Quick Search tidak lagi menawarkan Otomasi sebagai modul utama terpisah; Otomasi dijelaskan sebagai bagian dari Insights.
- Planner tidak lagi menampilkan kartu Life Copilot atau panel “3 cara memakai AI”; konteksnya sekarang langsung berada di workspace Rencana.
- Dashboard tidak lagi menampilkan Life Copilot sebagai pusat kendali; kartu tersebut diganti dengan Insights dan Rencana & simulasi.

## Validasi

Lulus:

```text
npm test      ✅
npm run verify ✅
TS/TSX transpile check (205 file) ✅
Guide/Settings version-wording check ✅
Canonical navigation regression ✅
Direct task-action regression ✅
Finance subscription regression ✅
```

`npm run typecheck` dan `npm run build` belum dapat diverifikasi penuh di lingkungan kerja karena dependency belum lengkap dan environment production (Supabase/OpenAI/Web Push/VAPID) tidak tersedia. Build production perlu dijalankan di mesin/VPS dengan `.env.local` yang benar setelah `npm ci`.
