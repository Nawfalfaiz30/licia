# Licia V34 — AI Intelligence & Full CRUD Upgrade

## Masalah yang diperbaiki

Kasus sebelumnya membuat Licia menampilkan pesan bahwa tool yang sama tidak dapat dipanggil lagi. Penyebabnya adalah guard tool-call yang terlalu ketat: panggilan identik diblokir bahkan ketika panggilan pertama gagal dan retry masih masuk akal.

## Upgrade utama

- Tool-call retry yang aman:
  - panggilan identik yang sudah berhasil dikembalikan dari cache hasil, bukan dieksekusi dua kali;
  - panggilan identik yang gagal dapat dicoba ulang sekali;
  - error policy/non-retryable tidak dipanggil ulang;
  - setelah retry limit tercapai, Licia diarahkan untuk mengganti strategi.
- Iterasi agent diperbesar untuk workflow multi-langkah:
  - normal: hingga 10 iterasi;
  - mutation workflow: hingga 14 iterasi;
  - vision workflow: hingga 12 iterasi.
- Routing lintas Life OS saat permintaan benar-benar menyentuh semua data kini membuka seluruh write surface yang tersedia, dengan perlindungan bulk/destructive tetap aktif.
- Fallback `manage_life_os_data` untuk CRUD pada entity yang belum mempunyai tool domain khusus.
- `get_unified_life_snapshot` sekarang menerima `limit` 4–30 agar AI dapat meminta konteks yang lebih luas tanpa query tanpa batas.
- Tool `get_habits` menyertakan `recent_checkins` agar AI dapat memverifikasi tanggal check-in.
- `checkin_habit` dan `uncheckin_habit` menerima `checkin_date`, tetapi memvalidasi kebijakan produk bahwa check-in hanya boleh dilakukan untuk hari ini pada timezone pengguna.
- AI prompt diperjelas agar tidak menganggap pemakaian ulang tool sebagai kegagalan; AI diarahkan untuk melanjutkan chain sampai tujuan selesai.
- Settings AI diperjelas menjadi akses seluruh data Life OS dan aksi CRUD yang dapat dijalankan ketika diminta.

## Tool surface

Versi ini berisi 97 tool definition. Semua tool definition mempunyai case handler di `executeTool`.

## Validasi

- 151 file TS/TSX berhasil diparse.
- 0 syntax error.
- V34 verification lulus.
- V34 test lulus.
- Security audit lulus.
