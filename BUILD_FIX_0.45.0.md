# Licia 0.45.0 — Build Fix

Perbaikan build production berdasarkan error TypeScript yang muncul pada `npm run build`:

- `app/(app)/tasks/page.tsx`
  - Menambahkan import `Link` dari `next/link`.
  - Menjadikan `priorityPlan.priorities` non-optional sehingga map/filter tidak lagi memunculkan TS18048.
- `lib/i18n.ts`
  - Menghapus deklarasi duplikat `knowledge_learning` dan `health_habits` pada bahasa Indonesia.

Regression:

```text
npm test    ✅
npm run verify ✅
```

Jalankan di PC/VPS:

```bash
npm ci
npm test
npm run verify
npm run typecheck
npm run build
```
