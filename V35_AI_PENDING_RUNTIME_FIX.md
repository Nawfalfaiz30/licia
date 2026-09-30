# V35 AI Pending Actions Runtime Fix

## Masalah

Batch AI dapat gagal dengan pesan:

```text
Could not find the 'completed_actions' column of 'ai_pending_actions' in the schema cache
```

## Perbaikan

- `/api/ai/batch` sekarang memiliki fallback kompatibilitas schema.
- Jika kolom metadata V34.1 belum tersedia atau PostgREST schema cache belum ter-refresh, batch tetap ditandai `applied` menggunakan kolom schema dasar.
- Response mengembalikan `metadataPersisted: false` agar kondisi degraded dapat diketahui tanpa menggagalkan aksi yang sudah dijalankan.
- `schema_v34_1_ai_execution.sql` sekarang mengirim `NOTIFY pgrst, 'reload schema'` setelah migration agar PostgREST segera memuat kolom baru.

## Migration yang disarankan

Jalankan sekali:

```text
supabase/schema_v34_1_ai_execution.sql
```

Jika migration sudah pernah dijalankan tetapi error schema cache masih muncul, jalankan kembali migration tersebut.
