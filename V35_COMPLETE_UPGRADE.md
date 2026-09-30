# Licia V35 — Complete Upgrade

V35 menyatukan 50 upgrade utama + 2 hardening tambahan ke dalam satu lapisan pengalaman Life OS.

## AI & Intelligence

1. AI Agent multi-langkah: baca → pahami → rencanakan → jalankan → verifikasi.
2. Preview rencana AI untuk perubahan massal.
3. Alasan tindakan AI yang operasional dan aman.
4. Confidence + penanganan ambiguitas.
5. Verifikasi state setelah mutasi.
6. Undo batch melalui AI Action History.
7. AI Watcher untuk kondisi proaktif.
8. Context freshness agar data unavailable tidak dianggap kosong.
9. Akses lintas Life OS ketika diizinkan.
10. Full CRUD Life OS melalui tool domain + fallback terkontrol.

## Life OS

11. Daily Brain / Otak Hari Ini.
12. Review cepat / Evening Review.
13. Weekly Review.
14. Capacity Planner.
15. What-if Planner tanpa mengubah data asli.
16. Dashboard adaptif berbasis kondisi hari ini.
17. Aksi kontekstual dan Ask This.
18. Life Graph 2.0 sebagai konteks hubungan entity.
19. Memory freshness: confidence, importance, konfirmasi terakhir, expiry.
20. Universal Capture untuk task, note, inbox, agenda, reminder.
21. Voice action.
22. Vision workflow untuk jadwal, struk, screenshot, dan dokumen.
23. Universal Search.
24. Calendar conflict detector.
25. Task dependency graph.
26. Finance insights dan perbandingan periode.
27. Health trend snapshot.
28. Focus rhythm.
29. Subscription watch.
30. Natural-language automation.

## Sync, Reliability & Push

31. Sync Center 2.0.
32. Smart Conflict Resolver.
33. Offline-first mutation queue.
34. Supabase Realtime invalidation.
35. Device registry.
36. Resync recovery untuk cursor yang tertinggal.
37. Push diagnostics VAPID/service-role/worker.
38. Worker health & heartbeat.
39. Queue Center lokal.
40. User-scoped performance cache.
41. Query batching/parallel intelligence reads.
42. Push action buttons (default Buka + custom actions).

## UX, Motion & Mobile

43. Motion System terpusat.
44. Bottom Sheet.
45. Command Palette Ctrl/Cmd+K.
46. Gesture feedback + haptic.
47. Ambient AI visual state.
48. Reduced-motion/accessibility handling.
49. Contextual action shortcuts.
50. Mobile-oriented feedback, queue/reconnect state, and compact action surfaces.

## Hardening tambahan

51. System Health Score & diagnostics.
52. Backup/recovery + privacy controls.

## Migration

Jalankan V35 schema setelah migration V30–V34:

```text
supabase/schema_v35_ai_experience.sql
```

Migration ini juga menambahkan metadata freshness pada `user_memories`:

- confidence
- importance
- last_confirmed_at
- expires_at

## Pemeriksaan release

```bash
npm ci
npm run verify:v35
npm run test:v35
npm run verify
npm run test
npm run audit
npm run typecheck
npm run build
```

`verify:v35` dan `test:v35` tidak membutuhkan database aktif. Keduanya melakukan pemeriksaan struktur/source-level.

## Area utama untuk diuji

- `/dashboard` — Daily Brain, Life Insights, Review Pulse, sync status
- `/chat` — agent, CRUD, plan preview, verification, image workflow
- `/planner` — capacity planner + What-if
- `/sync` — devices, queue, conflicts, resync
- `/system` — push diagnostics, worker health, schema, health score
- `/settings` — AI, sync, motion, haptic, voice, privacy, V35 controls
- `/guide` — panduan penggunaan dan troubleshooting V35
