# Navigation & Runtime Reliability

Perubahan ini menjaga workspace gabungan tetap menjadi navigasi utama, tetapi route detail tetap bisa dibuka dari kartu, pencarian, dashboard, dan tautan internal.

- Knowledge membuka Catatan, Memory, Vault, Bacaan, dan Belajar ke halaman detailnya.
- Kesehatan & Rutinitas membuka Kesehatan dan Rutinitas ke halaman detailnya.
- Target & Proyek tetap menjadi satu workspace utama; halaman detail target/proyek tetap dapat dibuka dari konteks internal.
- Modul Insights yang telah digabung tetap dapat membuka halaman detail ketika diperlukan.
- Next.js RSC/navigation requests tidak lagi dicegat service worker.
- Proxy Supabase mempertahankan satu response object saat menyegarkan cookie.
