# Licia V30 — Release Notes

V30 adalah major upgrade dari V29 dengan fokus pada konsistensi domain, intelligence layer, reminder reliability, dan observability.

## Intelligence

- Context Engine baru (`lib/ai/contextEngine.ts`)
- AI Model Router (`lib/ai/modelRouter.ts`)
- AI usage telemetry (`ai_usage_events`)
- Durable Life Event Bus (`life_os_events`)
- Actionable intelligence API
- AI chat memakai context signal terpilih, bukan seluruh database

## AI architecture

- Model selection dapat diarahkan lewat `LICIA_AI_MODEL`
- Request kompleks/gambar dapat menggunakan `LICIA_AI_HEAVY_MODEL`
- CRUD deterministik tetap didorong melalui tool layer
- Usage input/output/total token dicatat tanpa menyimpan secret

## Reminder Engine V30

- Central dispatch path
- Worker heartbeat
- delivery attempt counter
- last error telemetry
- stale processing recovery
- orphan target repair
- active reminder uniqueness guard
- task/schedule deletion cleanup
- task complete/deadline removal cleanup
- retry path dari halaman Pengingat
- dispatcher manual dari System Center
- polling Pengingat yang lebih responsif

## Notification reliability

- Dedupe dilakukan sebelum push delivery
- Existing delivered event tidak dikirim ulang
- Push delivery errors dicatat
- Expired/invalid push subscriptions dapat dibersihkan oleh delivery layer
- `schedule_soon` tidak lagi menjadi push path kedua untuk mencegah duplicate notification

## Auth & Next.js 16

- `middleware.ts` diganti `proxy.ts`
- Server Supabase client menggunakan async `cookies()`
- Async `searchParams` untuk route yang relevan
- App route authentication boundary diperluas
- Next.js 16.3.6 + React 19.2.8 baseline

## System Center V30

System Center sekarang bukan hanya halaman “status konfigurasi”. Ia membaca:

- database health
- V30 schema
- reminder worker heartbeat
- overdue/stuck/orphan reminder
- notification events
- push devices
- AI usage telemetry
- service worker state
- browser online state

## Database

Migration baru:

```text
supabase/schema_v30_core_intelligence.sql
```

Bootstrap all-in-one:

```text
supabase/schema_all_v30.sql
```

## Verification

Source V30 lulus:

```text
Parser check: 127 TS/TSX files, 0 syntax errors.
Licia verification passed.
Licia audit OK.
Licia V30 smoke tests passed.
```

Production build **belum tervalidasi di lingkungan audit ini** karena registry npm mengalami timeout dan `node_modules` tidak tersedia. Jalankan `npm ci` lalu `npm run build` pada mesin yang memiliki akses registry.
