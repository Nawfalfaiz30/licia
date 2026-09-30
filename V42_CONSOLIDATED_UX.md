# Konsolidasi UX Licia

Pembaruan ini merapikan struktur aplikasi tanpa menghapus mesin internal atau route kompatibilitas.

## Struktur yang terlihat pengguna

- **Beranda** — informasi hari ini, bukan panel Copilot atau tutorial.
- **Rencana** — Tugas, Kalender, Fokus; Perencana, Inbox, dan Pengingat berada sebagai subfitur.
- **Chat Licia** — percakapan, konteks, dan aksi yang memang membutuhkan bahasa natural.
- **Tangkap** — masukan teks, suara, dan gambar.
- **Insights** — review, pola, koneksi, dan riwayat AI yang relevan.
- **Target & Proyek** — target dan proyek dalam satu ruang.
- **Knowledge & Belajar** — catatan, memory, vault, bacaan, serta pembelajaran.
- **Keuangan** — transaksi, dompet, anggaran, dan langganan.
- **Kesehatan & Rutinitas** — satu hub dengan dua area detail yang tetap terpisah.
- **Otomatisasi** — aturan dan alur otomatis.

## Mobile

Footer mobile memakai **Lainnya** untuk membuka seluruh pilihan workspace yang tersedia, tetapi tidak mengembalikan menu yang sudah digabung.

## Chat

Tampilan percakapan dibuat lebih lapang: header ringkas, riwayat menjadi fokus, quick action tidak menumpuk di footer, dan status aksi hanya muncul saat relevan.

## Tugas

Aksi seperti prioritas, Agenda → Tugas, Inbox → Tugas, dan Tugas → Agenda bekerja langsung di halaman Tugas. Pengguna tidak dilempar ke Chat hanya untuk menjalankan transformasi yang sudah jelas.

## Keuangan

Langganan dikelola langsung dari Keuangan dan ikut dihitung sebagai komitmen rutin dalam ringkasan arus kas.
