# Licia 0.35.7 — AI CRUD & Name-First Upgrade

## Masalah yang diperbaiki

Sebelumnya konfirmasi hapus satu item masih bergantung terlalu besar pada model. Setelah Licia menemukan satu kandidat, model bisa memanggil tool delete lagi tanpa `confirm_*_id`, sehingga muncul pesan berulang seperti:

> Target belum dikonfirmasi untuk dihapus.

Pola ini sekarang ditangani deterministik di server.

## Perubahan utama

### 1. Konfirmasi hapus deterministik
Setelah satu target ditemukan dan ditampilkan, respons seperti `ya`, `iya`, `oke`, `hapus`, `hapus sekarang`, `lanjutkan`, `konfirmasi`, `jalankan`, atau `terapkan` langsung menggunakan target ID yang sudah dikonfirmasi.

Model tidak perlu mencari target lagi.

### 2. Tidak ada retry delete kandidat dalam satu turn
Jika `delete_*` menghasilkan `single_candidate_needs_confirmation`, loop tool berhenti pada turn tersebut. Ini mencegah satu permintaan menghasilkan dua atau lebih pesan konfirmasi yang sama.

### 3. Hasil CRUD dibedakan secara semantik
`ok:true` saja tidak dianggap sebagai perubahan. Status `single_candidate_needs_confirmation`, `multiple_candidates`, `confirmation_required`, `preview`, `no_match`, dan `no_changes` tetap dianggap belum diterapkan.

### 4. Semua mutation tetap terhubung ke executeTool
Audit V35.7 memastikan seluruh mutation tool yang diekspos mempunyai handler `executeTool`, termasuk create/update/delete/check-in/logging dan fallback CRUD.

### 5. AI lebih sering memanggil pengguna dengan nama
System prompt sekarang menginstruksikan Licia untuk memprioritaskan nama panggilan pengguna dibanding sapaan generik seperti `kamu`, terutama saat menyapa, mengonfirmasi tindakan, menyampaikan hasil, dan menutup respons.

## Tidak memerlukan migration database
Upgrade ini tidak menambah tabel/kolom Supabase.

## Verifikasi

```bash
npm run verify:crud
npm run test:crud
npm run typecheck
npm run build
```
