# Licia 0.38.0 — Personal Intelligence & Reliability Upgrade

V38 meneruskan konsolidasi V37 dengan fokus pada **kualitas keputusan AI, perencanaan harian, feedback, mobile UX, dan efisiensi context**.

## Perubahan utama

### Smart Daily Plan
Workspace Rencana sekarang memiliki Smart Daily Plan yang menggabungkan:
- deadline dan prioritas task;
- agenda hari berjalan;
- ruang waktu yang masih tersedia;
- fokus yang sudah dilakukan;
- target aktif.

Planner menggunakan fallback deterministik dan dapat memakai model AI saat diminta refresh. Hasilnya hanya rekomendasi dan tidak langsung mengubah kalender.

### End-of-Day Review
Insights mendapatkan review penutup hari yang menghitung:
- task selesai;
- agenda selesai;
- menit fokus;
- task terlambat;
- pekerjaan yang layak dibawa ke besok.

### Temporal Reliability
Chat sekarang membangun temporal guard deterministik sebelum model bekerja pada permintaan bertanggal/waktu. Pasangan seperti `Sabtu tanggal 26` divalidasi dengan engine tanggal Licia dan tool `resolve_calendar_date` otomatis diekspos saat dibutuhkan.

### AI Context Metadata
Balasan Chat mengembalikan metadata internal:
- model yang digunakan;
- smart/full context;
- domain yang dirouting;
- domain yang ditolak privacy policy;
- apakah temporal guard aktif.

UI Chat menampilkan indikator ringkas agar pengguna tahu jawaban memakai Smart Context atau Full Context dan apakah validasi tanggal aktif.

### Feedback terstruktur
Jawaban AI sekarang memiliki tombol 👍/👎. Feedback disimpan bersama kategori, excerpt jawaban, dan metadata context sehingga dapat dipakai untuk evaluasi regression test.

### Context caching
Connected context menggunakan cache singkat 2,5 detik per user + kombinasi domain. Mutation tetap membatalkan cache user melalui `invalidateUserContext`.

### Mobile UX
Bottom navigation menampilkan Insights sebagai pilar kelima ketika user sedang berada di navigasi utama. Area More tetap dipakai untuk modul legacy/advanced.

## Pemeriksaan

```bash
npm test
npm run verify
npm run typecheck
npm run build
```

## Migrasi database

Jalankan:

```text
supabase/schema_v38_ai_feedback.sql
```

Migration ini hanya menambahkan metadata ke tabel `ai_insight_feedback`; tidak mengubah data bisnis yang sudah ada.
