# Licia V29 — Dashboard, Reminder & System Center

## Perubahan
- Dashboard dipadatkan menjadi ringkasan harian minimalis dengan logo Licia dan informasi inti.
- Copy hero diganti menjadi `Ini ringkasan harianmu.`
- Dashboard menghubungkan task, agenda, reminder, notification, finance, goals, health, project, automation, memory, subscription, focus, dan activity.
- Current balance dihitung dari saldo awal akun + seluruh income - seluruh expense yang tersedia dalam batas query dashboard.
- System Center menjadi panel operasional dengan service health, browser notification test, reminder test 1 menit, manual dispatch, push test, dan setup server.
- Reminder dispatch mendukung mode `?mode=client` yang lebih ringan untuk polling browser.
- Notification Center default polling dipercepat menjadi 1 menit tetapi memakai dispatch ringan.
- Ditambahkan `scripts/reminder-cron.mjs` untuk cron VPS per menit.
- Preflight production sekarang memberi pesan yang jelas jika `web-push` belum terpasang.

## Dependency
`web-push` dan `@types/web-push` sudah berada di `package.json`. Jalankan `npm install` setelah mengganti source jika node_modules berasal dari versi lama.

## Catatan arsitektur
- Browser notification: bekerja ketika web aktif dan izin Notification API diberikan.
- Web Push: bekerja ketika service worker + subscription + VAPID + service role siap.
- Reminder Center: event tetap disimpan di `notification_events`, sehingga histori tidak hilang.
- Cron VPS: jalur 24/7 untuk memproses reminder ketika browser tidak terbuka.

## Reliability patch
- Fixed Dashboard JSX structure and reduced visual density: compact header, Licia logo, 4 primary metrics, focused Today block, finance, goals, calendar, health, systems, and activity.
- Dashboard balance label corrected to `Saldo berjalan`.
- System Center now detects missing V28 feature tables instead of silently showing zero counts. It reports missing `reminders`, `notification_events`, or `push_subscriptions` and points to `supabase/schema_v28_intelligence.sql`.
- System Center Service Worker status now checks the actual active registration instead of treating `navigator.serviceWorker.ready` as a boolean.
- System Center reminder test now uses `/api/reminders/test`, the same authenticated server path used by the feature.
- Browser notification test now persists the local browser-notification switch; enabling push also enables the browser fallback flag.
- Notification Center can surface a recently-created unread event on first load, preventing a reminder from being silently missed when the event existed just before the page loaded.
- Notification client rejects insecure HTTP for device/browser notifications with a clear HTTPS/localhost message.
- Reminder page removed undefined `warn` utility classes.
- Added `scripts/reminder-worker.mjs` and a `licia-reminder-worker` PM2 app. It dispatches reminders every 60 seconds in production; this is an alternative to OS crontab.
- Production preflight already checks whether `web-push` is actually installed, so stale node_modules now fail early with an actionable message.
