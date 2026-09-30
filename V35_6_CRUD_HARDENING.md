# Licia V35.6 — CRUD & Bulk Calendar Hardening

## Perbaikan utama

- Menambahkan `delete_schedule_blocks_bulk` untuk penghapusan massal agenda dengan pengecualian.
- Permintaan seperti `hapus semua agenda kecuali interview KEYENCE` sekarang diarahkan ke satu operasi bulk yang aman.
- `kecuali/selain/pertahankan ...` diekstrak dari permintaan pengguna dan disimpan dalam pending batch.
- Pencocokan pengecualian judul tidak bergantung pada urutan kata; `interview KEYENCE` tetap cocok dengan `KEYENCE 1st Interview - ...`.
- Batch executor membedakan hasil preview/confirmation/no-op dari mutation yang benar-benar berhasil.
- Pending batch lama untuk bulk kalender dipaksa menjadi executable `confirm_all=true` ketika pengguna menekan Terapkan.
- Hasil delete kandidat (`single_candidate_needs_confirmation` / `multiple_candidates`) tidak lagi dihitung sebagai sukses.
- Verifikasi mutation delete mendukung `deleted: { id: ... }`.
- Audit CRUD statis memastikan 81 mutation tool memiliki handler `executeTool` dan jalur bulk kalender lengkap.

## QA perintah

```powershell
npm run verify:crud
npm run test:crud
npm run verify:v35
npm run test:v35
npm run test:v34-ai2
npm run test:v34-ai3
npm run test:v35-wallet
npm run audit
```

## Pengujian manual penghapusan agenda

```text
User:
Hapus semua agenda saya selain interview KEYENCE

Licia:
preview jumlah agenda yang akan dihapus + agenda yang dipertahankan

User:
Hapus sekarang

Licia:
jalankan delete_schedule_blocks_bulk(confirm_all=true)
→ hapus target
→ pertahankan KEYENCE
→ batalkan reminder agenda yang ikut terhapus
→ verifikasi
→ laporkan jumlah aktual
```

Jangan menggunakan pending batch lama dari versi sebelum V35.6 bila batch tersebut sudah pernah gagal/ambigu; buat permintaan baru agar argumen dan target dihitung ulang.
