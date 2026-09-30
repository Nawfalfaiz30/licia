# Licia V34 — Complete Sync, Performance & Experience Upgrade

V34 menyatukan fondasi V31–V33 menjadi pengalaman Life OS yang lebih konsisten dan tahan terhadap koneksi buruk, penggunaan multi-device, serta konflik data.

## Sinkronisasi

- Universal mutation API untuk domain Life OS utama.
- Idempotency melalui `mutation_id`.
- Row versioning dan cursor sync.
- Device registry dan Sync Center.
- Realtime invalidation.
- Offline queue + Service Worker replay.
- Resync detection ketika sejarah event sudah dipangkas.
- Perubahan preferensi akun ikut tersinkron lintas perangkat.

## Conflict Resolver V34

- Server, latest, manual, dan smart strategy.
- Event sync menyimpan `changed_fields` agar smart merge dapat mengetahui perubahan server setelah `baseVersion`.
- Field yang berubah di sisi berbeda dapat digabungkan dengan aman.
- Perubahan pada field yang sama tetap meminta keputusan pengguna.
- Riwayat konflik disimpan server-side.
- Target mutation yang hilang ditandai `TARGET_NOT_FOUND`, bukan dibiarkan `processing` selamanya.

## Performance

- User-scoped server cache dengan TTL pendek.
- Dashboard query batching dan cache.
- Index tambahan untuk task, reminder, goals, projects, inbox, finance, dan sync history.
- Debounced refresh setelah sync event.
- Daily snapshot ringan untuk dashboard/tinjauan.

## Experience

- Motion system konsisten.
- Reduced motion dan `prefers-reduced-motion`.
- Ripple, press, sheet, stagger, success feedback, dan animated number.
- Haptic feedback.
- Voice Capture.
- Global Quick Capture.
- Proactive Insight.
- Sync status badge dan offline visibility.
- Mobile-safe bottom sheets dan touch targets.

## Pengaturan

- Strategi konflik.
- Interval sync.
- Sync saat fokus, kembali ke aplikasi, dan koneksi pulih.
- Status sync.
- Push reconnect.
- Voice language.
- Motion intensity.
- Reduced motion.
- Haptics dan sound feedback.
- Smart planner dan proactive assistant.
- Daily snapshot dan Life Graph linking.
- Enter-to-send behavior yang konsisten.

## Database migration

Jalankan setelah V33:

```text
supabase/schema_v34_sync_robustness.sql
```

Urutan lengkap:

```text
V30 core intelligence
→ V31 sync
→ V32 sync experience
→ V33 Life OS
→ V34 sync robustness
```

## Verification

```bash
npm run verify
npm run test
npm run audit
npm run typecheck
npm run build
```

`typecheck` dan `build` harus dijalankan pada environment dengan `node_modules` production lengkap.
