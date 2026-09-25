# Licia V28 — Full Intelligence, Reminder & Notification Upgrade

## Scope
V28 menggabungkan upgrade Life OS besar tanpa memperluas Universal Command/Command Palette sebagai fokus baru. Fokus utama:

- AI Orchestrator / tool execution yang lebih deterministik
- Unified Context Engine lintas modul
- Smart Inbox / action continuity
- Daily Intelligence, Timeline, Weekly Review, Automation foundation
- Notification Center persisten
- Web Push + Service Worker
- Reminder Engine dengan reminder custom, agenda-bound, dan task-bound
- Reminder continuity untuk percakapan AI multi-turn
- Life Graph Goal → Project → Task
- System Center
- Backup/restore merge + AI Action History/Undo
- Security validation untuk push subscription
- Offline/PWA foundation
- Calendar `.ics` export
- Automated audit script

## Important behavior
### Reminder continuity
Percakapan seperti:

1. "Jadwal saya besok"
2. "Ingatkan saya untuk berangkat jam 11 karena harus ke akademik"
3. "Oke buatkan"

sekarang memiliki jalur deterministic di server. Konfirmasi pendek akan memakai permintaan reminder terakhir, menyelesaikan tanggal berdasarkan konteks percakapan dan timezone pengguna, lalu menjalankan `create_reminder` secara langsung. Ada dedupe berdasarkan judul + waktu sehingga tidak membuat reminder ganda.

### All Life OS data
Saat `aiReadAllData` aktif, model selalu mendapatkan akses ke:

- `get_unified_life_snapshot`
- `get_life_module_data`
- `search_life_os`

Selain context ringkas, model dapat mengambil detail modul yang relevan. Snapshot mencakup task, kalender, project, goals, milestones, notes, inbox, focus, habits, skills, reading, finance, subscriptions, memory, vault, automations, reminders, notifications, decisions, journal, relations, interactions, accounts, budgets, health, daily plans, anime/watchlist, dan reading sessions.

## Supabase migration
Jalankan:

`supabase/schema_v28_intelligence.sql`

Migration ini membuat:

- `push_subscriptions`
- `reminders`
- `notification_events`

serta memastikan `users.preferences` tersedia.

## Environment for Web Push
Tambahkan di `.env.local` VPS:

```env
SUPABASE_SERVICE_ROLE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
LICIA_CRON_SECRET=...
```

Generate VAPID:

```bash
npx web-push generate-vapid-keys
```

## Reminder dispatcher
Dispatcher utama:

`GET /api/reminders/dispatch`

- Cron dengan `x-licia-cron-secret` memproses semua user.
- Session user dapat menjalankan dispatcher untuk dirinya sendiri.
- Reminder stuck dalam status `processing` lebih dari 10 menit dipulihkan menjadi `pending`.
- Agenda yang dipindah akan dihitung ulang berdasarkan `offset_minutes`.

Rekomendasi: jalankan dispatcher setiap menit di VPS.

## User configuration
Settings → Workspace → `Pengingat agenda`:

- Tidak otomatis
- 5 menit
- 10 menit
- 15 menit
- 30 menit
- 1 jam
- 2 jam

Settings → Experience:

- Browser notifications
- Push device
- Notification polling

Reminder Center menyediakan `Terapkan default 14 hari` untuk membuat reminder otomatis pada agenda dan task bertime yang sudah ada.

## New routes
- `/reminders`
- `/system`
- `/life-graph`
- `/api/reminders/dispatch`
- `/api/reminders/sync-defaults`
- `/api/push/vapid-public`
- `/api/push/subscribe`
- `/api/push/test`
- `/api/calendar/ics`

## QA
- `npm run verify` → PASS
- `npm run audit` → PASS
- TypeScript/TSX parser → 119 files, 0 syntax errors
- CSS parser → 0 errors
- CSS braces → balanced
- runtime localhost scan → 0

## Production verification checklist
1. Install dependencies because V28 adds `web-push`:
   `npm install`
2. `npm run preflight`
3. `npm run verify`
4. `npm run audit`
5. `npm run build`
6. Apply Supabase migration.
7. Set Web Push VAPID + service role + cron secret on VPS.
8. Configure cron every minute.
9. Open Settings → enable Push → Send test.
10. Open `/system`; Push server and Cron reminder should show OK.
11. Create an agenda with a future start time and test its default reminder.
12. Test AI continuity with a reminder request followed by "Oke buatkan".


## V28.0.1 build fix
- Fixed `app/(app)/guide/page.tsx`: added missing `Activity` import used by the System Center guide item.
