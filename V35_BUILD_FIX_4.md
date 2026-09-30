# Licia V35 — Build Fix 4

Perbaikan ini menargetkan error TypeScript production build:

1. `app/api/proactive/evaluate/route.ts`
   - Menambahkan `entity_type` pada query `ai_watchers` karena proactive evaluator menggunakannya sebagai fallback metric.

2. `app/api/v35/insights/route.ts`
   - Menambahkan tipe `HealthMetricKey` dan `HealthMetricRow` agar akses trend menggunakan key yang valid dan tidak memicu implicit string indexing.

3. `lib/events/bus.ts`
   - Menambahkan event type `ai_watcher.created`, `ai_watcher.updated`, dan `ai_watcher.deleted` ke `LifeEventType`.

4. `lib/ai/tools.ts`
   - Memperbaiki pemanggilan `emitLifeEvent()` dari `type` menjadi `eventType` pada pembuatan AI watcher.

Catatan:
- Dependency lengkap perlu dipasang dengan `npm ci` pada environment project untuk verifikasi TypeScript penuh.
- Tidak ada secret runtime yang dimasukkan ke release.
