# Licia — UI/UX Refinement & Workspace Simplification

## Chat Licia
- Percakapan dibuat lebih tenang dengan bubble yang lebih pendek, batas lebar yang lebih nyaman, dan header yang lebih ringkas.
- Metadata teknis tidak lagi memenuhi setiap pesan.
- Aksi pesan (feedback/hapus/evidence singkat) dipindahkan ke tombol konteks kecil agar percakapan tidak menumpuk.
- Ringkasan aksi dan undo tetap berada di area status yang terpisah dari percakapan utama.
- Riwayat tampilan dibatasi agar halaman mobile tidak terlalu panjang dan berat.

## Lainnya di ponsel
- Tombol footer menggunakan **Lainnya**.
- Lainnya sekarang adalah indeks lengkap workspace canonical.
- Fitur yang sudah digabung tidak muncul lagi sebagai menu lama kedua.
- Pencarian, Panduan, dan Pengaturan tetap tersedia dari Lainnya.

## Konsolidasi Ruang Hidup
- Target & Proyek menjadi satu pintu masuk untuk target dan proyek.
- Knowledge & Belajar menjadi satu pintu masuk untuk catatan, memory, vault, bacaan, dan pembelajaran.
- Keuangan menjadi satu pintu masuk untuk transaksi, anggaran, dompet, dan langganan.
- Kesehatan & Rutinitas menjadi satu pintu masuk untuk kesehatan dan kebiasaan.
- Insights menjadi satu pusat untuk review, pola, koneksi, linimasa, analitik, dan otomasi.

## Tugas
- Prioritas dengan Licia dijalankan langsung di halaman Tugas.
- Agenda → Tugas membuat task dan menghubungkannya dengan agenda.
- Tugas → Agenda mencari slot kosong dan membuat agenda terhubung.
- Inbox → Tugas dan Agenda → Pengingat juga dikerjakan langsung tanpa mengalihkan pengguna ke Chat.
- Setelah aksi prioritas, daftar task dimuat ulang agar perubahan langsung terlihat.

## Keuangan
- Langganan tetap berada di Keuangan dan tidak menjadi workspace terpisah.
- Keuangan mendapat aksi cepat untuk pemasukan, pengeluaran, dan langganan.
- Ringkasan menampilkan komitmen bulanan, tahunan, porsi komitmen terhadap pemasukan, dan nilai tagihan 30 hari.
- Pembayaran langganan tetap dapat dicatat menjadi transaksi pengeluaran.

## Panduan & Pengaturan
- Panduan mengikuti struktur workspace canonical.
- Panduan tidak memakai nama milestone internal atau label versi sebagai bahasa pengguna.
- Pengaturan menjelaskan workspace yang sebenarnya tampil di desktop dan mobile.
- Start page legacy dinormalisasi ke workspace induknya.
- Privasi AI memakai kelompok data yang sama dengan workspace gabungan.

## Mobile/Desktop parity
- Desktop dan mobile menggunakan daftar workspace canonical yang sama.
- Route legacy tetap boleh hidup sebagai kompatibilitas internal, tetapi tidak ditampilkan kembali pada navigasi utama atau Lainnya.

## Validasi
```text
npm test                    ✅
npm run verify              ✅
TS/TSX transpile check     ✅
Canonical navigation       ✅
Chat compact interaction   ✅
Direct task actions        ✅
Finance/subscription UX    ✅
Guide/settings wording     ✅
```

Full production build tetap perlu dijalankan di mesin/VPS yang sudah memiliki dependency dan environment production.
