# Licia V34 — Build Fixes

Perbaikan pada build production berikut:

- `calendar/page.tsx`: menyesuaikan `SyncMutationResult.error` yang bertipe `string | undefined`.
- `focus/page.tsx`: menambahkan import `mutateEntity`.
- `health/page.tsx`: memperbaiki referensi variabel error yang salah pada `addWater()`.
- `notes/page.tsx`: menambahkan `version` ke tipe dan query note serta mengganti referensi `rows` yang tidak ada menjadi `notes`.
- `components/ui/Card`: sekarang menerima prop HTML `id` untuk anchor/scroll target.
- `components/dashboard/QuickCapture.tsx`: menambahkan import `notifyToast`.

Validasi lokal source:

- 154 file TS/TSX diparse.
- 0 syntax error.

Catatan: production `npm run build` penuh tetap harus dijalankan pada environment yang memiliki seluruh dependency `npm ci` terpasang.
