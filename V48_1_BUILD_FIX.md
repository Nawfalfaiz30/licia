# Build Fix

Memperbaiki error TypeScript pada halaman Tugas:

- `priorityPlan.priorities` sekarang dinormalisasi melalui `priorityItems`, sehingga tidak lagi dianggap mungkin `undefined` di JSX.
- `Link` dari `next/link` ditambahkan sebelum penggunaan tombol "Mulai fokus".

Perubahan ini tidak mengubah schema database.

Validasi source-level:
- `node scripts/verify-v48.mjs` ✅
- `node scripts/test-v48.mjs` ✅

Build production perlu dijalankan di lingkungan project yang memiliki `node_modules`.
