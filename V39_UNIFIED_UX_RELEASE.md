# Licia 0.39.0 — Unified UX & Dashboard

## Fokus rilis

V39 menyederhanakan permukaan produk dan memperbaiki beberapa masalah UI/UX yang terlihat langsung pada penggunaan harian.

### 1. Koreksi agenda "hari ini"

`/today` sebelumnya membaca seluruh `schedule_blocks` tanpa membatasi `block_date`, sehingga daftar agenda dapat berisi jadwal hari lain.

Sekarang query menggunakan tanggal lokal pengguna:

```text
user_id = current user
block_date = today's date in user's timezone
```

Dashboard juga memakai cache key yang memasukkan tanggal dan timezone sehingga pergantian hari tidak mewarisi snapshot dashboard lama.

### 2. Target & Proyek menjadi satu workspace

`/goals-projects` sekarang menjadi route kanonik dengan tab:

```text
Target | Proyek
```

Route lama tetap kompatibel:

```text
/goals   → /goals-projects?tab=goals
/projects → /goals-projects?tab=projects
```

Mesin CRUD tetap dipakai melalui `GoalsWorkspace` dan `ProjectsWorkspace`, sehingga data dan logic yang sudah ada tidak perlu dimigrasikan.

### 3. Konsolidasi navigasi

Navigasi sehari-hari dikurangi agar pengguna tidak melihat banyak menu yang melakukan hal serupa.

Yang disatukan/diturunkan dari navigasi utama:

- Tasks + Calendar + Focus → pusat `Rencana`
- Notes + Memory + Vault + Reading → `Knowledge`
- Subscriptions → `Keuangan`
- Life Copilot + Life Command → AI melalui `Chat`
- Brief + Review Center + Timeline + Life Graph → area `Insights`/Peta Hidup
- Hari Ini → tetap tersedia sebagai workspace pendukung, tidak menjadi menu utama
- System / Sync / Privacy → area Sistem

Route lama tetap dipertahankan untuk kompatibilitas.

### 4. Dashboard dirombak

Bagian tepat setelah greeting sekarang berisi informasi nyata:

- agenda hari ini,
- ringkasan keuangan bulan berjalan,
- task terbuka dan keterlambatan,
- fokus,
- progress target,
- inbox,
- notifikasi belum dibaca,
- next move.

Komponen yang sebelumnya memenuhi area atas dashboard dihapus dari mount dashboard:

- Life Copilot Card
- AI Mode Guide / "cara memakai Licia"
- Action Plan Center / "Rencana tindakan Licia"

### 5. Greeting lebih bervariasi

Greeting menggunakan utilitas terpusat dengan beberapa varian per periode:

```text
pagi       → Selamat pagi / Pagi yang tenang / Pagi yang cerah / Mari mulai hari
siang      → Selamat siang / Siang yang produktif / Hari masih berjalan / Mari lanjutkan hari
sore       → Selamat sore / Sore yang tenang / Sore yang santai / Mari rapikan sisa hari
malam      → Selamat malam / Malam yang tenang / Hari mulai melambat / Saatnya merapikan sisa hari
```

Pemilihan varian deterministik berdasarkan hari, bukan `Math.random`, sehingga hasil server/client stabil.

### 6. Notifikasi benar-benar opaque

Panel notifikasi sebelumnya dapat memperlihatkan teks dashboard di bawahnya karena kombinasi background custom CSS variable + opacity modifier Tailwind.

V39:

- memakai `bg-surface` yang opaque,
- memaksa `background: var(--surface) !important`,
- `opacity: 1`,
- `isolation: isolate`,
- item riwayat memakai background opaque,
- overlay dimatikan sedikit lebih gelap agar panel lebih terbaca.

### 7. Motion polish

Ringkasan dashboard mendapatkan staggered entrance animation ringan yang mengikuti motion system Licia. `prefers-reduced-motion` tetap dihormati.

## Database migration

V39 **tidak membutuhkan migration Supabase baru**. Semua perubahan bersifat UI, routing, query selection, cache key, dan kompatibilitas route.

## Validation

```text
npm test             ✅
npm run verify       ✅
TS/TSX syntax check ✅
```

Full production build tetap perlu dijalankan di environment yang memiliki dependency lengkap.
