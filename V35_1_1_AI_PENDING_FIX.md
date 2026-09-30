# Licia V35.1.1 — AI Pending Actions Transition Fix

Memperbaiki error runtime:

`invalid ai_pending_actions status transition: pending -> applied`

Akar masalah berada pada trigger legacy di database, bukan pada model AI. Trigger lama menolak transisi `pending -> applied` walaupun status tersebut valid pada schema baseline.

Migration:

```text
supabase/schema_v35_1_1_ai_pending_transition.sql
```

Migration ini:

- menemukan trigger legacy yang secara eksplisit melempar error transition tersebut,
- menghapus hanya trigger tersebut,
- memasang validator baru dengan transition yang eksplisit,
- memastikan kolom metadata V34.1 tersedia,
- memperbarui RLS/index bila perlu,
- memerintahkan PostgREST reload schema cache.

Valid transition:

```text
pending -> applied
pending -> applied_with_errors
pending -> cancelled
pending -> expired
```

Setelah menjalankan migration, restart aplikasi agar koneksi server menggunakan schema terbaru.
