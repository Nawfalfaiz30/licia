# 🌙 Licia — Personal Life OS

<p align="center">
  <img src="public/licia-avatar.png" alt="Licia" width="112" />
</p>

<p align="center">
  <strong>AI-powered Personal Life OS untuk mengatur tugas, agenda, tujuan, pengetahuan, kesehatan, keuangan, fokus, dan pengingat dalam satu ruang pribadi.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Licia-v0.57.1-6d5dfc?style=for-the-badge" alt="Licia v0.57.1" />
  <img src="https://img.shields.io/badge/Next.js-16.3.6-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16.3.6" />
  <img src="https://img.shields.io/badge/React-19.2.8-149eca?style=for-the-badge&logo=react&logoColor=white" alt="React 19.2.8" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PWA-Offline%20Ready-5a67d8?style=flat-square" alt="PWA" />
  <img src="https://img.shields.io/badge/Web%20Push-Enabled-0ea5e9?style=flat-square" alt="Web Push" />
  <img src="https://img.shields.io/badge/AI-Tool%20Calling-8b5cf6?style=flat-square" alt="AI Tool Calling" />
  <img src="https://img.shields.io/badge/i18n-ID%20%2F%20EN-10b981?style=flat-square" alt="Indonesia English" />
  <img src="https://img.shields.io/badge/Sync-Conflict%20Aware-f59e0b?style=flat-square" alt="Conflict Aware Sync" />
</p>

<p align="center"><em>Capture it. Understand it. Organize it. Act on it.</em></p>

---

## 🧭 Daftar Isi

- [Apa itu Licia?](#-apa-itu-licia)
- [Konsep inti](#-konsep-inti)
- [Arsitektur singkat](#-arsitektur-singkat)
- [Fitur utama](#-fitur-utama)
- [Modul aplikasi](#-modul-aplikasi)
- [AI & intelligence layer](#-ai--intelligence-layer)
- [AI reliability & safety](#-ai-reliability--safety)
- [Reminder & Web Push](#-reminder--web-push)
- [Offline, PWA & multi-device sync](#-offline-pwa--multi-device-sync)
- [Backup, export & undo](#-backup-export--undo)
- [Security & privacy](#-security--privacy)
- [Tech stack](#-tech-stack)
- [Struktur repository](#-struktur-repository)
- [Instalasi development](#-instalasi-development)
- [Environment variables](#-environment-variables)
- [Setup Supabase](#-setup-supabase)
- [Setup Web Push](#-setup-web-push)
- [Production & VPS](#-production--vps)
- [Quality checks](#-quality-checks)
- [API overview](#-api-overview)
- [Workflow contoh](#-workflow-contoh)
- [Troubleshooting](#-troubleshooting)
- [Riwayat versi](#-riwayat-versi)
- [Kontribusi](#-kontribusi)

---

## ✨ Apa itu Licia?

**Licia** adalah aplikasi **Personal Life OS**: sebuah workspace pribadi yang menggabungkan produktivitas, AI, knowledge management, planning, kesehatan, keuangan, refleksi, dan otomatisasi.

Licia dibangun dengan prinsip bahwa aplikasi kehidupan pribadi seharusnya tidak terdiri dari puluhan silo yang tidak saling terhubung. Tugas, agenda, tujuan, pengingat, catatan, keuangan, pembelajaran, fokus, dan insight seharusnya dapat membentuk satu konteks yang bisa dipahami oleh pengguna maupun AI.

```text
                   ┌─────────────────────┐
                   │       Capture       │
                   └──────────┬──────────┘
                              ↓
                   ┌─────────────────────┐
                   │     Smart Inbox     │
                   └──────────┬──────────┘
                              ↓
          ┌──────────────────────────────────────┐
          │ Task · Note · Goal · Project · Event │
          └──────────────────┬───────────────────┘
                             ↓
      ┌───────────────────────────────────────────────┐
      │ Calendar · Focus · Habit · Health · Finance   │
      │ Learning · Reading · Memory · Vault           │
      └──────────────────────┬────────────────────────┘
                             ↓
                 ┌──────────────────────┐
                 │  Context / AI Layer  │
                 └──────────┬───────────┘
                            ↓
        ┌─────────────────────────────────────────┐
        │ Insight · Plan · Reminder · Action     │
        └─────────────────────────────────────────┘
```

### Prinsip utama

> **Data nyata → konteks relevan → tindakan terkontrol → hasil terverifikasi.**

Licia bukan hanya chatbot dan bukan sekadar to-do list. Chat AI dapat membaca konteks Life OS, menggunakan tool, menjalankan mutation, mencatat action history, dan mengembalikan hasil berdasarkan data yang benar-benar tersimpan.

---

# 🧠 Konsep inti

## 1. One Life OS, bukan banyak aplikasi terpisah

Semua domain hidup berada di satu workspace sehingga hubungan antardata tetap terlihat:

```text
Goal
 ├── Project
 │    ├── Task
 │    ├── Subtask
 │    └── Calendar
 │
 ├── Focus
 ├── Habit
 └── Review
```

Contoh lain:

```text
Calendar event
      ↓
Reminder
      ↓
Web Push
      ↓
Notification Event
      ↓
Timeline / Review
```

## 2. Capture first, organize later

Licia menyediakan jalur cepat untuk menampung ide atau informasi tanpa memaksa pengguna langsung menentukan struktur sempurna.

```text
Input cepat
   ↓
Capture
   ↓
Inbox
   ↓
AI triage / manual organize
   ↓
Task / Note / Memory / Expense / Event / dst.
```

## 3. AI bekerja sebagai operator, bukan hanya generator teks

AI mempunyai akses ke context, routing, validation, tool execution, history, recovery, dan undo. Oleh karena itu, jawaban AI dapat berupa:

- penjelasan,
- pencarian data,
- rencana,
- pembuatan atau perubahan data,
- batch action,
- reminder,
- ringkasan,
- insight,
- atau kombinasi beberapa langkah.

---

# 🗺️ Arsitektur singkat

```mermaid
flowchart TD
    USER[User] --> WEB[Next.js Web / PWA]
    WEB --> UI[React UI]
    UI --> API[Next.js Route Handlers]

    API --> AUTH[Supabase Auth]
    API --> DB[(Supabase PostgreSQL)]
    API --> AI[AI Runtime]
    API --> SYNC[Sync Layer]
    API --> PUSH[Web Push]

    AI --> CTX[Context Engine]
    AI --> ROUTER[Model Router]
    AI --> TOOLS[Tool Router + Validation]
    TOOLS --> DB

    DB --> RLS[Row Level Security]
    SYNC --> CONFLICT[Conflict Center]
    PUSH --> WORKER[Reminder Worker]
    WORKER --> DISPATCH[/api/reminders/dispatch]
    DISPATCH --> DB

    AI --> HISTORY[AI Action History]
    API --> SYSTEM[System Center Diagnostics]
```

### Alur mutation AI

```text
UNDERSTAND
    ↓
ROUTE
    ↓
VALIDATE
    ↓
ACT
    ↓
VERIFY
    ↓
RESPOND
```

Mutasi tidak dianggap sukses hanya karena tool dipanggil. Licia berusaha memverifikasi hasil data sebelum memberikan konfirmasi sukses.

---

# 🚀 Fitur utama

## 🤖 AI Chat

Route utama: **`/chat`**

Chat Licia dapat digunakan untuk pertanyaan biasa maupun operasi Life OS.

Contoh:

```text
"Apa yang harus saya selesaikan hari ini?"

"Cari tugas yang belum selesai minggu ini dan prioritaskan berdasarkan deadline."

"Buat task untuk menyiapkan presentasi hari Jumat jam 9 pagi."

"Atur pengingat 30 menit sebelum agenda besok."

"Ringkas kondisi produktivitas saya minggu ini."
```

### Kemampuan AI

- Context-aware conversation
- Tool calling
- Natural language planning
- Search lintas Life OS
- Task/project/calendar operations
- Reminder operations
- Finance operations
- Memory/knowledge operations
- AI action history
- Undo untuk action yang memenuhi syarat
- Batch/mass actions dengan pending confirmation
- Streaming SSE
- Stop/cancel pada streaming chat
- Fallback model
- Circuit breaker
- Retry untuk error jaringan/rate limit/server
- Perlindungan terhadap prompt injection dari data pengguna

---

## 🧩 Context Engine

Licia memisahkan **intent saat ini** dari topik percakapan lama.

Sistem mempertimbangkan hal seperti:

- pergantian topik,
- follow-up,
- referensi entitas seperti “yang tadi”,
- domain Life OS yang relevan,
- kebutuhan pencarian,
- mode planner/analyst,
- dan operasi mutation.

Context dapat berasal dari:

```text
Current message
      ↓
Intent / domain detection
      ↓
Context selection
      ↓
Relevant Life OS data
      ↓
AI reasoning / tool execution
```

Untuk kebutuhan lintas domain tersedia pendekatan snapshot/unified context sehingga AI tidak harus menerima seluruh database pada setiap permintaan.

---

## 🧰 AI Tool Layer

Tool layer dirancang agar AI bekerja terhadap data nyata, bukan sekadar memberi teks yang terlihat seperti tindakan.

Kategori operasi yang didukung mencakup:

| Domain | Contoh operasi |
|---|---|
| Tasks | create, update, complete, delete, batch |
| Subtasks | create, update, complete |
| Projects | create, update, archive |
| Goals | create, progress, milestone |
| Calendar | agenda, schedule, completion |
| Focus | focus session, Pomodoro |
| Inbox | capture, triage, organize |
| Notes | create, search, update |
| Memory | save, search, update |
| Vault | knowledge/private content |
| Learning | skills, progress, next action |
| Reading | books, sessions, notes |
| Habits | habit, check-in |
| Finance | account, income, expense, budget, subscription |
| Health | health logs and metrics |
| Reminder | create, update, cancel, dispatch |
| Automation | automation rules and evaluation |
| Search | cross-module search |
| AI history | action log, batch result, undo |

Tool arguments divalidasi sebelum eksekusi. Untuk action yang berisiko atau destruktif, Licia dapat menggunakan **pending action / confirmation** sebelum menerapkan perubahan.

---

## 🧭 AI mode & model routing

Model dipilih melalui `lib/ai/modelRouter.ts` berdasarkan kompleksitas request.

Faktor yang dapat memengaruhi pemilihan route antara lain:

- adanya image/vision input,
- panjang request,
- intent kompleks,
- kata yang berkaitan dengan planning, perubahan, analisis, atau schedule,
- jumlah domain yang disentuh,
- mode `planner`,
- mode `analyst`.

Konfigurasi utama:

```env
LICIA_AI_MODEL=
LICIA_AI_HEAVY_MODEL=
LICIA_AI_TOOL_MODEL=
LICIA_AI_FALLBACK_MODEL=
```

Source saat ini mempunyai default model di router. Untuk deployment hemat biaya, Anda dapat mengatur model yang diinginkan secara eksplisit melalui `LICIA_AI_MODEL`; model untuk tool call dapat dipisahkan melalui `LICIA_AI_TOOL_MODEL` apabila diperlukan.

---

## 🔄 AI fallback & circuit breaker

Bila model utama mengalami error yang layak diulang, Licia dapat mencoba model cadangan bila `LICIA_AI_FALLBACK_MODEL` diisi.

Contoh kondisi yang dapat memicu fallback:

```text
429 rate limit
408 / timeout
409 / transient conflict
425
5xx
model_not_found / model unavailable
network error tanpa status
```

Tidak semua error di-fallback. Error credential seperti `401/403` dan pembatalan pengguna tidak diperlakukan sebagai kegagalan model yang perlu dipindahkan ke model lain.

Circuit breaker juga digunakan untuk menghindari retry berulang ke model yang sedang bermasalah.

```text
3 kegagalan berturut-turut
        ↓
model utama dilewati sementara
        ↓
fallback dipakai bila tersedia
        ↓
cooldown
        ↓
half-open retry
```

---

## 🌐 Internationalization — Indonesia / English

Mulai `v0.57.0`, UI diarahkan ke sistem i18n terpusat.

### Karakteristik

- Bahasa **Indonesia** dan **English**
- String UI diproses lewat `tr()`
- Bahasa disimpan pada cookie `licia-language`
- localStorage dipakai untuk pengalaman client
- `<html lang>` mengikuti bahasa aktif
- API tertentu menerima konteks bahasa pengguna
- Chat AI diarahkan membalas sesuai bahasa antarmuka
- Format angka dan tanggal mengikuti locale
- Placeholder/pluralization didukung
- Audit i18n tersedia melalui `npm run i18n:check`

Sumber translation berada di:

```text
i18n-src/en.json
i18n-src/keys.json
lib/i18n.ts
lib/i18n/en.ts
lib/i18n/server.ts
```

Build kamus Inggris:

```bash
npm run i18n:build
```

Validasi:

```bash
npm run i18n:check
```

---

# 🧭 Modul aplikasi

Licia saat ini memiliki workspace yang luas. Route utama yang tersedia di source:

| Modul | Route | Fokus |
|---|---|---|
| 🏠 Dashboard | `/dashboard` | Ringkasan Life OS dan quick actions |
| 📆 Today | `/today` | Agenda, task, focus, aktivitas hari ini |
| 🤖 Chat | `/chat` | AI assistant dan tool execution |
| ⚡ Command | `/command` | Command center / natural-language actions |
| 📥 Capture | `/capture` | Quick capture, voice, share target |
| 📥 Smart Inbox | `/inbox` | Inbox + triage |
| ✅ Tasks | `/tasks` | Task, subtask, priority, deadline, views |
| 📅 Calendar | `/calendar` | Schedule dan agenda |
| 🗓️ Planner | `/planner` | Perencanaan mingguan |
| 📋 Plan | `/plan` | Workspace rencana |
| 📁 Projects | `/projects` | Pekerjaan multi-step |
| 🎯 Goals | `/goals` | Target, progress, milestone |
| 🎯 Goals & Projects | `/goals-projects` | Workspace gabungan target/proyek |
| ⏱️ Focus | `/focus` | Sesi fokus |
| 🍅 Pomodoro | `/pomodoro` | Pomodoro dan histori fokus |
| 🔁 Habits | `/habits` | Rutinitas dan check-in |
| 🎓 Learning | `/learning` | Skill, progress, next action |
| 📚 Reading | `/reading` | Buku/bacaan dan reading sessions |
| 🗒️ Notes | `/notes` | Catatan pribadi |
| 🧠 Memory | `/memory` | Memori jangka panjang yang dipilih pengguna |
| 🔐 Vault | `/vault` | Knowledge/private vault |
| 💰 Finance | `/finance` | Income, expense, account, budget |
| 🔁 Subscriptions | `/subscriptions` | Pembayaran berulang dan renewal |
| ❤️ Health | `/health` | Log kesehatan dan metrik |
| 🗺️ Life Map | `/life-map` | Hubungan data antar-domain |
| 🕸️ Life Graph | `/life-graph` | Graph hubungan Goal/Project/Task |
| 🕒 Timeline | `/timeline` | Riwayat aktivitas/perubahan |
| 📊 Analytics | `/analytics` | Analitik lintas modul |
| 💡 Insights | `/insights` | Insight berbasis data |
| 🌊 Life Pulse | `/pulse` | Snapshot kondisi Life OS |
| 📰 Brief | `/brief` | Brief / ringkasan |
| 🔎 Search | `/search` | Search lintas Life OS |
| 🧠 AI History | `/ai-history` | Log action AI, batch, undo |
| 🔔 Reminders | `/reminders` | Reminder dan delivery state |
| ⚙️ Automations | `/automations` | Trigger → condition → action |
| 📝 Decisions | `/decisions` | Jurnal pengambilan keputusan |
| 🩺 System Center | `/system` | Diagnostics, telemetry, service status |
| 🔄 Sync | `/sync` | Status sinkronisasi dan konflik |
| 🔍 Review Center | `/review-center` | Review terpusat |
| 📖 Guide | `/guide` | Panduan penggunaan |
| ⚙️ Settings | `/settings` | Preferensi, AI, UI, PWA, data |
| 🔒 Privacy Center | `/privacy-center` | Kontrol privasi akun |
| 📡 Copilot | `/copilot` | Pengalaman AI proaktif |
| 📚 Knowledge | `/knowledge` | Knowledge workspace |
| 📈 Review | `/review` | Review/reflection workflow |
| 🔗 Relations | `/relations` | Data relasional/connection workspace |
| 🩺 Wellbeing | `/wellbeing` | Ringkasan wellbeing |

> Tidak semua route harus muncul di navigasi utama pada setiap ukuran layar. Sidebar, bottom navigation, command palette, dan quick search dapat mengatur akses sesuai konteks device.

---

# 🔔 Reminder & Web Push

Reminder Licia adalah **server-backed**, bukan timer browser yang hanya aktif ketika tab terbuka.

## Komponen

```text
Task / Calendar / Subscription / Habit / Custom reminder
                        ↓
                 Reminder Engine
                        ↓
                  reminders table
                        ↓
               Dispatcher endpoint
                        ↓
              notification_events
                        ↓
                 Web Push delivery
                        ↓
              Service Worker / Browser
```

### Kapabilitas

- Custom reminder
- Task-bound reminder
- Schedule-bound reminder
- Goal/project/subscription/habit reminder
- Default schedule reminders
- Retry delivery
- Overdue handling
- Delivery attempt limits
- Push subscription registration
- Notification event history
- Test push
- Reminder test
- Worker health/diagnostics
- Deduplication sebelum delivery
- Recovery untuk state yang macet

## Variable utama

```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com

SUPABASE_SERVICE_ROLE_KEY=
LICIA_CRON_SECRET=
LICIA_REMINDER_WORKER_INTERVAL_MS=60000
LICIA_REMINDER_MAX_DELIVERY_ATTEMPTS=5
LICIA_REMINDER_MAX_OVERDUE_MS=86400000
```

## Worker

Production menggunakan proses PM2 kedua:

```text
licia-reminder-worker
```

Worker menjalankan request ke:

```text
/api/reminders/dispatch
```

Dengan header rahasia:

```text
x-licia-cron-secret
```

Interval minimal yang diterima worker adalah **30 detik**; nilai default proyek adalah **60 detik**.

### Penting

Gunakan **satu dispatcher utama** di production. Jangan menjalankan PM2 worker dan cron dispatcher yang memanggil endpoint yang sama pada interval yang sama tanpa alasan yang jelas, karena dapat menyebabkan duplicate delivery atau race.

Alternatif manual/cron tersedia melalui:

```bash
node scripts/reminder-cron.mjs
```

---

# 📱 Offline, PWA & multi-device sync

Licia memiliki fondasi Progressive Web App dengan service worker.

## PWA

File utama:

```text
public/manifest.webmanifest
public/sw.js
public/offline.html
public/icon-192.png
public/icon-512.png
public/icon-maskable-192.png
public/icon-maskable-512.png
```

Manifest menyediakan shortcut untuk:

- Rencana
- Chat
- Tangkap
- Insights
- Target & Proyek

Licia juga mendukung **Share Target** sehingga teks/link dari menu Share perangkat dapat masuk ke Capture.

## Offline queue

Service worker menyimpan mutation tertentu menggunakan IndexedDB lalu mencoba mengirimkannya kembali saat koneksi tersedia.

```text
Offline input
     ↓
IndexedDB queue
     ↓
Network returns
     ↓
/api/sync/mutation
     ↓
Applied / Replay / Conflict
```

## Conflict resolution

Bila perubahan perangkat bertabrakan dengan versi server, Licia dapat menyimpan conflict dan menampilkannya pada Conflict Center.

Pilihan resolusi mencakup:

- **Pakai server**
- **Pakai perangkat**
- **Gabungkan aman**
- **Buang**

Entity yang dapat terlibat dalam conflict mencakup task, schedule, project, goal, note, inbox, reminder, memory, finance, subscription, health, habit, reading, automation, vault, focus session, dan domain lain yang memakai sync layer.

---

# 🎨 UX & accessibility

Licia dirancang untuk desktop maupun mobile dengan fokus pada layout yang tetap ringan di layar kecil.

### UI foundation

- Responsive sidebar / bottom navigation
- Command palette
- Quick search
- Bottom sheet / overlay
- Toast system
- Skeleton loading
- Motion runtime
- Reduced motion support
- Haptic feedback untuk device yang mendukung
- Touch target yang diperhatikan untuk mobile
- Keyboard navigation pada daftar
- Skip link dan focus state
- ARIA dialog/listbox untuk komponen interaktif
- Contrast audit untuk tema

### Command palette

`Ctrl+K` pada Windows/Linux atau `⌘K` pada macOS membuka pusat perintah/pencarian.

Contoh prefix command:

```text
t teks       → buat task
 i teks      → kirim ke inbox
$ teks       → catat pengeluaran
> perintah   → jalankan command
```

Command palette juga mendukung navigasi keyboard.

### Shortcut daftar

Pada daftar tertentu:

```text
J / K     → pindah item
X         → selesai / arsip sesuai konteks
E         → edit
Enter     → buka
```

Shortcut tidak aktif saat pengguna sedang mengetik atau ketika overlay/modal mengambil alih fokus.

---

# 💾 Backup, export & undo

## Data export

API export menyediakan bentuk data yang dapat disimpan untuk arsip.

```text
GET/POST /api/export-data
```

## JSON backup

Licia juga menyediakan jalur backup terstruktur melalui:

```text
/api/backup
```

## Restore / merge

Restore dirancang agar tidak secara otomatis menghapus semua data yang tidak ada dalam backup. Payload tetap dibatasi dan `user_id` diperlakukan sebagai data milik user yang sedang login.

## AI Action History

`/ai-history` menyimpan metadata action AI yang benar-benar dieksekusi, termasuk informasi operasi dan snapshot ketika tersedia.

```text
AI action
   ↓
Action history
   ├── tool
   ├── operation
   ├── table/domain
   ├── record ids
   ├── before snapshot
   ├── after snapshot
   └── undo state
```

---

# 🔐 Security & privacy

## Supabase Row Level Security

Data pengguna menggunakan **RLS** untuk membatasi akses berdasarkan `auth.uid()` pada tabel yang sesuai.

## Service role

`SUPABASE_SERVICE_ROLE_KEY` hanya boleh digunakan di server.

**Jangan pernah:**

- memakai service role pada `NEXT_PUBLIC_*`,
- memasukkannya ke source browser,
- commit secret ke Git,
- memasukkannya ke README,
- menyimpan real secret di `.env.example`,
- menampilkan secret di screenshot/log.

## Vault: client-side encryption

Vault menggunakan enkripsi sisi client:

```text
Passphrase
   ↓
PBKDF2-SHA256
   ↓
AES-GCM 256
   ↓
Encrypted envelope
```

Implementasinya berada di:

```text
lib/crypto/vaultCrypto.ts
```

Karakteristik penting:

- AES-GCM 256-bit
- PBKDF2-SHA256
- 310.000 iterasi derivasi key
- passphrase tidak dikirim sebagai secret ke server
- key sesi berada di memory client
- data terenkripsi menggunakan prefix `enc:v1:`

> **Lupa passphrase Vault berarti data terenkripsi tidak dapat dipulihkan melalui server.**

## AI privacy

Context AI dibentuk sesuai kebutuhan request. Isi Vault yang terenkripsi tidak diperlakukan sebagai plaintext context sebelum dibuka oleh pengguna/client dengan kredensial yang tepat.

## Security headers

`next.config.js` memasang header keamanan seperti:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- HSTS ketika origin production menggunakan HTTPS

---

# 🧰 Tech stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16.3.6 |
| UI | React 19.2.8 |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS 3.4 |
| Icons | Lucide React |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth + SSR |
| AI | OpenAI API |
| Push | Web Push / VAPID |
| PWA | Web App Manifest + Service Worker |
| Testing | Vitest + custom verification scripts |
| Lint | ESLint 9 + Next config |
| Formatting | Prettier |
| Runtime | Node.js 22.x |
| Process manager | PM2 |
| Reverse proxy | Nginx |

### Engine requirement

```json
{
  "node": ">=22 <23",
  "npm": ">=10"
}
```

Gunakan Node **22.x** agar konsisten dengan project.

---

# 📦 Struktur repository

```text
licia/
├── app/
│   ├── (app)/                    # seluruh workspace Life OS
│   ├── (auth)/                   # login / signup
│   ├── api/                      # server route handlers
│   ├── privacy/                  # public privacy page
│   ├── globals.css
│   └── layout.tsx
│
├── components/
│   ├── chat/                     # Chat UI
│   ├── intelligence/             # proactive intelligence
│   ├── intelligence/...          # insight / daily plan / review
│   ├── layout/                   # sidebar, topbar, mobile nav
│   ├── settings/                 # settings controls
│   ├── sync/                     # conflict UI
│   ├── tasks/                    # task views
│   └── ui/                       # reusable primitives
│
├── lib/
│   ├── ai/                       # AI runtime, tools, context, routing
│   ├── chat/                     # streaming helper
│   ├── crypto/                   # Vault encryption
│   ├── domain/                   # domain lifecycle
│   ├── events/                   # event bus
│   ├── notifications/            # push / notification logic
│   ├── pwa/                      # offline queue
│   ├── reminders/                # reminder scheduling
│   ├── supabase/                 # client / server / admin
│   ├── sync/                     # sync + conflict handling
│   └── v35 / v36                # advanced intelligence layers
│
├── public/
│   ├── sw.js                     # service worker
│   ├── manifest.webmanifest      # PWA metadata
│   ├── offline.html              # offline fallback
│   └── icons / avatar
│
├── scripts/
│   ├── build.mjs
│   ├── preflight.mjs
│   ├── reminder-worker.mjs
│   ├── reminder-cron.mjs
│   ├── setup-push.mjs
│   ├── healthcheck.mjs
│   ├── audit.mjs
│   ├── eval.mjs
│   └── test / verify scripts
│
├── supabase/
│   ├── schema_all.sql             # baseline consolidated schema
│   ├── schema_v*.sql              # incremental migrations
│   └── schema_ai_chat_history.sql # server chat history
│
├── deploy/
│   ├── ecosystem config example
│   ├── reminder worker service
│   └── nginx configuration
│
├── tests/
├── .env.example
├── ecosystem.config.cjs
├── next.config.js
├── package.json
└── README.md
```

---

# 🛠️ Instalasi development

## 1. Clone repository

```bash
git clone <repository-url>
cd licia
```

## 2. Pastikan Node benar

```bash
node -v
npm -v
```

Target:

```text
Node 22.x
npm 10+
```

## 3. Install dependency

```bash
npm ci
```

`npm ci` lebih disarankan daripada `npm install` untuk checkout production/reproducible karena menggunakan lockfile.

## 4. Siapkan environment

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Isi minimal variable wajib sebelum build production.

## 5. Preflight development

```bash
npm run preflight:dev
```

## 6. Jalankan development

```bash
npm run dev
```

Default:

```text
http://localhost:3000
```

## 7. Typecheck

```bash
npm run typecheck
```

## 8. Build production

```bash
npm run build
```

Build menjalankan prebuild/preflight terlebih dahulu.

## 9. Start production lokal

```bash
npm run start
```

---

# 🔐 Environment variables

Template lengkap berada di `.env.example`.

## Wajib

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Penjelasan

| Variable | Fungsi | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL client | Ya |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public/anon key | Ya* |
| `SUPABASE_URL` | Supabase URL server | Tidak perlu diekspos |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin/server-side DB operation | **Rahasia** |
| `OPENAI_API_KEY` | akses AI server-side | **Rahasia** |
| `NEXT_PUBLIC_SITE_URL` | origin utama app | Ya |

\* Walaupun anon/publishable key memang dimaksudkan untuk client, akses sebenarnya tetap dibatasi RLS.

---

## 🤖 AI

```env
LICIA_AI_MODEL=
LICIA_AI_HEAVY_MODEL=
LICIA_AI_TOOL_MODEL=
LICIA_AI_FALLBACK_MODEL=
LICIA_AI_OMIT_TEMPERATURE=true
LICIA_AI_REASONING_EFFORT=none
LICIA_AI_DAILY_TOKEN_LIMIT=0
LICIA_CHAT_STREAM=true
```

### Rekomendasi konfigurasi hemat

Untuk mengontrol biaya, tentukan model secara eksplisit daripada bergantung pada default source:

```env
LICIA_AI_MODEL=gpt-4o-mini
```

Nilai tersebut hanyalah contoh konfigurasi. Gunakan model yang memang tersedia dan sesuai akun/API environment Anda.

Untuk tool calling, bila diperlukan:

```env
LICIA_AI_TOOL_MODEL=<model-compatible-tool-calling>
```

Untuk fallback:

```env
LICIA_AI_FALLBACK_MODEL=<backup-model>
```

### Generation compatibility

Default project:

```env
LICIA_AI_OMIT_TEMPERATURE=true
LICIA_AI_REASONING_EFFORT=none
```

Runtime dapat mencoba ulang sekali jika provider menolak parameter generation tertentu seperti `temperature` atau `reasoning_effort`.

### AI token budget

```env
LICIA_AI_DAILY_TOKEN_LIMIT=0
```

`0` berarti tidak mengaktifkan limit aplikasi. Bila ingin membatasi:

```env
LICIA_AI_DAILY_TOKEN_LIMIT=50000
```

Gunakan angka sesuai kebutuhan dan budget Anda.

---

## 🔔 Web Push & reminder

```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com

LICIA_CRON_SECRET=
LICIA_REMINDER_WORKER_INTERVAL_MS=60000
LICIA_REMINDER_MAX_DELIVERY_ATTEMPTS=5
LICIA_REMINDER_MAX_OVERDUE_MS=86400000
```

---

## 🛡️ Security / network

```env
LICIA_ALLOW_MISSING_ORIGIN=false
LICIA_URL=http://localhost:3000
LICIA_INTERNAL_URL=
LICIA_CONTEXT_CACHE_TTL_MS=
LICIA_SYNC_CONFLICT_RETENTION_DAYS=30
LICIA_DEV_ORIGINS=
DEV_TUNNEL_ORIGIN=
```

### `LICIA_INTERNAL_URL`

Pada VPS yang menjalankan web dan worker pada mesin yang sama, nilai yang nyaman biasanya:

```env
LICIA_INTERNAL_URL=http://127.0.0.1:3000
```

Dengan ini worker berbicara langsung ke Next.js tanpa perlu melewati Nginx.

---

# 🗄️ Setup Supabase

## Fresh database

File baseline yang dikonsolidasikan adalah:

```text
supabase/schema_all.sql
```

File tersebut idempotent pada bagian-bagian yang menggunakan `if not exists` / `drop policy if exists` dan dirancang sebagai baseline schema gabungan.

## Incremental migrations

Source saat ini juga membawa migration lanjutan. Untuk database yang sudah mengikuti baseline lama, terapkan migration secara berurutan sesuai kebutuhan versi:

```text
schema_v34_1_ai_execution.sql
schema_v34_sync_robustness.sql
schema_v35_1_1_ai_pending_transition.sql
schema_v35_1_finance_wallet.sql
schema_v35_ai_experience.sql
schema_v36_intelligence.sql
schema_v37_unified_workspaces.sql
schema_v38_ai_feedback.sql
schema_ai_chat_history.sql
```

### Chat history server-side

Untuk penyimpanan riwayat chat lintas perangkat, jalankan:

```text
supabase/schema_ai_chat_history.sql
```

Tabel utama:

```text
public.ai_chat_messages
```

Client tetap dapat menggunakan cache localStorage untuk responsivitas UI, tetapi server database menjadi sumber riwayat yang dapat dipulihkan lintas device setelah migration diterapkan.

## Pending AI action migration

Database lama yang membawa trigger status transition lama perlu memastikan migration:

```text
supabase/schema_v35_1_1_ai_pending_transition.sql
```

sudah diterapkan agar status seperti:

```text
pending → applied
pending → applied_with_errors
pending → cancelled
pending → expired
```

diterima oleh trigger terbaru.

---

# 🔔 Setup Web Push

Cara paling sederhana untuk membuat VAPID keys:

```bash
npm run setup:push
```

Script akan membantu membuat:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
LICIA_CRON_SECRET=...
```

Script juga mengingatkan bahwa `SUPABASE_SERVICE_ROLE_KEY` harus diisi secara manual dari Supabase server-side credentials.

### Setelah setup

Restart aplikasi/worker agar environment baru terbaca.

Contoh PM2:

```bash
pm2 reload ecosystem.config.cjs
```

atau saat pertama kali:

```bash
pm2 start ecosystem.config.cjs
```

### Cek di UI

Buka:

```text
/settings
/system
```

Pada status push, Licia mengecek komponen penting seperti:

```text
VAPID
Service role
Worker auth / cron secret
```

Jika salah satu belum tersedia, UI akan memberikan status yang jelas.

---

# ⏰ Reminder production

## Option A — PM2 worker, direkomendasikan

`ecosystem.config.cjs` sudah mendefinisikan dua proses:

```text
licia
licia-reminder-worker
```

Jalankan:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

Lihat log worker:

```bash
pm2 logs licia-reminder-worker --lines 100
```

### Proses web

```text
127.0.0.1:3000
```

### Proses worker

```text
scripts/reminder-worker.mjs
```

Worker memanggil dispatcher setiap interval:

```text
LICIA_REMINDER_WORKER_INTERVAL_MS
```

Default project:

```text
60000 ms = 60 detik
```

---

## Option B — system cron

Bila Anda tidak menggunakan PM2 worker, tersedia:

```bash
node scripts/reminder-cron.mjs
```

Cron/systemd harus memanggil script ini sesuai interval yang Anda pilih.

> Jangan mengaktifkan scheduler yang berulang secara paralel tanpa memahami konsekuensinya. Gunakan satu sumber scheduling untuk dispatcher production.

---

# 🏭 Production & VPS

Licia dapat dijalankan dengan pola:

```text
Internet
   ↓
Nginx / HTTPS
   ↓
127.0.0.1:3000
   ↓
Next.js / PM2

PM2 ───────────────→ reminder worker
                       ↓
                  /api/reminders/dispatch
```

## 1. Server requirements

- Ubuntu/Linux server
- Node 22.x
- npm 10+
- PM2
- Nginx
- domain + HTTPS untuk deployment publik
- Supabase
- OpenAI API key

## 2. Clone

```bash
cd ~
git clone <repository-url> licia
cd licia
```

## 3. Install

```bash
npm ci
```

## 4. Environment production

Contoh minimum:

```env
NODE_ENV=production
PORT=3000

NEXT_PUBLIC_SITE_URL=https://domain-kamu.example
LICIA_URL=https://domain-kamu.example
LICIA_INTERNAL_URL=http://127.0.0.1:3000

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

OPENAI_API_KEY=...

VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com

LICIA_CRON_SECRET=...
```

## 5. Verify

```bash
npm run preflight
npm run typecheck
npm run test:unit
npm run build
```

## 6. Start PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

## 7. Health check

Bila `LICIA_URL` sudah menunjuk ke domain yang dapat diakses server:

```bash
npm run health
```

Endpoint health:

```text
/api/health
```

## 8. Nginx

Template tersedia di:

```text
deploy/nginx-licia.conf
```

Service example:

```text
deploy/licia.service.example
deploy/licia-reminder-worker.service.example
```

Untuk setup HTTPS, pastikan reverse proxy meneruskan request ke:

```text
http://127.0.0.1:3000
```

---

# 🔄 Update deployment

Pola update yang cocok untuk VPS dengan storage terbatas:

```bash
cd ~
rm -rf licia
git clone <repository-url> licia
cd licia
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

Bila instance PM2 lama masih aktif, gunakan:

```bash
pm2 delete licia licia-reminder-worker
pm2 start ecosystem.config.cjs
pm2 save
```

Untuk update tanpa menghapus proses:

```bash
npm ci
npm run build
pm2 reload ecosystem.config.cjs
pm2 save
```

> Jangan lupa mempertahankan `.env.local`/environment produksi. Secret tidak boleh berasal dari repository Git.

---

# 🧪 Quality checks

## Build

```bash
npm run build
```

## TypeScript

```bash
npm run typecheck
```

## Lint

```bash
npm run lint
```

## Unit tests

```bash
npm run test:unit
```

## Full project test suite

```bash
npm test
```

`npm test` menggabungkan beberapa pemeriksaan, termasuk unit test, i18n check, contrast audit, serta regression scripts yang berasal dari beberapa versi fitur terbaru.

## CI shortcut

```bash
npm run ci
```

Saat ini menjalankan:

```text
npm run typecheck
npm run lint
npm run test:unit
```

## i18n

```bash
npm run i18n:build
npm run i18n:check
```

## Contrast / accessibility

```bash
npm run a11y:contrast
```

## Audit

```bash
npm run audit
```

## AI evaluation

```bash
npm run eval
```

Dry run:

```bash
npm run eval:dry
```

Golden cases tersedia pada:

```text
evals/golden.json
```

---

# 🧪 Testing philosophy

Licia tidak hanya memeriksa apakah halaman dapat dirender. Test dan verification scripts digunakan untuk menjaga beberapa kontrak penting:

### AI

- tool routing
- smart parse
- fallback model
- pending action
- action history
- AI UX
- model compatibility

### Data

- CRUD
- finance
- sync
- conflict
- domain verification

### UI

- shortcut
- command palette
- list navigation
- dashboard layout
- progress/date helpers

### Security/quality

- i18n consistency
- contrast
- syntax/build checks

---

# 🔌 API overview

Route API utama saat ini dikelompokkan sebagai berikut.

## Core

```text
/api/chat
/api/search
/api/activity
/api/health
/api/backup
/api/export-data
/api/onboarding
/api/estimate-nutrition
/api/weekly-planner
```

## AI

```text
/api/ai/history
/api/ai/undo
/api/ai/batch
/api/intelligence
/api/intelligence/context
/api/intelligence/daily-snapshot
/api/proactive/evaluate
/api/inbox/triage
/api/tasks/assist
```

## Push / notification / reminder

```text
/api/notifications
/api/push/subscribe
/api/push/test
/api/push/vapid-public
/api/reminders/dispatch
/api/reminders/sync-defaults
/api/reminders/test
```

## Sync

```text
/api/sync/status
/api/sync/register-device
/api/sync/pull
/api/sync/mutation
/api/sync/conflicts
/api/sync/resolve
/api/sync/preferences
```

## V35 / V36 intelligence

```text
/api/v35/brain
/api/v35/features
/api/v35/health
/api/v35/insights
/api/v35/review
/api/v35/watchers
/api/v35/what-if

/api/v36/copilot
/api/v36/evidence
/api/v36/feedback
/api/v36/plan
/api/v36/review
/api/v36/search
/api/v36/temporal
```

## V38 / daily intelligence

```text
/api/v38/daily-plan
/api/v38/daily-review
/api/v38/feedback
```

> API tidak semuanya intended untuk dipanggil langsung oleh browser. Beberapa route adalah internal server workflow dan menggunakan session, service-role access, atau secret header.

---

# 🔄 Workflow contoh

## 1. Ide → Task

```text
"Belajar TypeScript 30 menit besok jam 8 malam"
              ↓
          Smart Parse
              ↓
      tanggal + waktu + title
              ↓
             Task
```

Parsing cepat dilakukan di perangkat pada input yang sesuai, sehingga tidak selalu memerlukan AI.

## 2. Inbox → struktur

```text
Capture
  ↓
Smart Inbox
  ↓
AI triage
  ├── Task
  ├── Note
  ├── Memory
  ├── Expense
  └── Other domain
```

## 3. Agenda → reminder

```text
Calendar event
      ↓
Reminder offset
      ↓
reminders
      ↓
notification_events
      ↓
Web Push
```

## 4. AI → mutation aman

```text
User request
      ↓
Understand intent
      ↓
Choose context
      ↓
Choose tool/model
      ↓
Validate arguments
      ↓
Execute mutation
      ↓
Read back / verify
      ↓
Record action history
      ↓
Respond
```

## 5. Offline → sync

```text
User action
   ↓
Offline queue
   ↓
Connection returns
   ↓
Sync mutation
   ├── success → remove queue
   └── conflict → Conflict Center
```

---

# 🩺 System Center

Route:

```text
/system
```

System Center ditujukan sebagai titik diagnosis saat production mengalami masalah.

Area yang relevan antara lain:

- service configuration,
- AI configuration,
- push configuration,
- worker authentication,
- sync status,
- diagnostics,
- runtime/telemetry.

Untuk masalah reminder/web push, tiga komponen paling sering diperiksa adalah:

```text
VAPID keys
SUPABASE_SERVICE_ROLE_KEY
LICIA_CRON_SECRET
```

Kemudian periksa worker:

```bash
pm2 status
pm2 logs licia-reminder-worker --lines 100
```

---

# 🐛 Troubleshooting

## `VAPID + service role belum lengkap. Worker cron belum dikonfigurasi.`

Periksa:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
SUPABASE_SERVICE_ROLE_KEY=...
LICIA_CRON_SECRET=...
```

Kemudian jalankan:

```bash
npm run setup:push
```

Lalu restart:

```bash
pm2 reload ecosystem.config.cjs
```

Dan cek:

```bash
pm2 status
pm2 logs licia-reminder-worker --lines 100
```

---

## Worker langsung mati

Pesan umum:

```text
LICIA_INTERNAL_URL/APP_URL/NEXT_PUBLIC_SITE_URL dan LICIA_CRON_SECRET wajib tersedia.
```

Pastikan:

```env
LICIA_INTERNAL_URL=http://127.0.0.1:3000
LICIA_CRON_SECRET=...
```

Kemudian restart worker.

---

## Reminder tidak terkirim

Urutan pemeriksaan:

```text
1. Reminder ada dan enabled?
2. remind_at sudah waktunya?
3. Supabase service role tersedia?
4. VAPID lengkap?
5. Browser sudah memberi permission notification?
6. Push subscription masih valid?
7. Worker hidup?
8. /api/reminders/dispatch merespons 2xx?
```

Coba endpoint test dari UI atau gunakan log worker.

---

## `Invalid Refresh Token: Refresh Token Not Found`

Biasanya berkaitan dengan session/cookie Supabase yang tidak lagi valid pada browser tertentu.

Langkah aman:

1. logout dari Licia,
2. hapus session/cookie domain aplikasi bila diperlukan,
3. login kembali,
4. pastikan domain HTTPS dan origin konsisten,
5. jangan mencampur origin dev tunnel, localhost, dan domain production dalam satu sesi browser.

Untuk production, usahakan:

```text
NEXT_PUBLIC_SITE_URL = domain HTTPS yang sebenarnya
LICIA_URL            = domain HTTPS yang sebenarnya
```

Dan gunakan `LICIA_INTERNAL_URL` untuk komunikasi worker internal bila diinginkan.

---

## AI function tools ditolak provider/model

Gunakan model tool yang kompatibel:

```env
LICIA_AI_TOOL_MODEL=<compatible-model>
```

Untuk kestabilan generation:

```env
LICIA_AI_OMIT_TEMPERATURE=true
LICIA_AI_REASONING_EFFORT=none
```

Runtime memiliki retry compatibility untuk parameter generation tertentu, tetapi model yang benar-benar tidak mendukung tool calling tetap harus diganti/di-route ke model yang sesuai.

---

## Chat streaming bermasalah

Matikan streaming sementara:

```env
LICIA_CHAT_STREAM=false
```

Restart server.

Jika streaming diaktifkan:

```env
LICIA_CHAT_STREAM=true
```

Chat menggunakan SSE dan mengenal event seperti:

```text
status
tool_start
tool_done
final
error
```

---

## Build TypeScript gagal

Bersihkan artefak Next.js:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
```

atau Linux:

```bash
rm -rf .next
```

Lalu:

```bash
npm run typecheck
npm run build
```

Jika error berasal dari file test lama, periksa `tsconfig.json` dan pastikan konfigurasi typecheck sesuai dengan target build project sebelum menghapus atau mengabaikan test secara sembarangan.

---

## i18n gagal

Jalankan:

```bash
npm run i18n:build
npm run i18n:check
```

Periksa:

```text
i18n-src/en.json
i18n-src/keys.json
lib/i18n.ts
lib/i18n/en.ts
```

---

## PWA tidak update setelah deploy

Service worker memiliki cache version.

Bila browser tetap memakai asset lama:

1. reload penuh,
2. unregister service worker di DevTools bila perlu,
3. clear site data,
4. buka ulang aplikasi.

Jangan mengedit cache key service worker tanpa alasan; lakukan perubahan cache secara sengaja saat versioning PWA.

---

## Push hanya bekerja setelah browser dibuka

Browser notification dan Web Push harus dibedakan dari local timer client.

Production reminder mengandalkan server dispatcher + push subscription.

Periksa worker terlebih dahulu, bukan hanya tab browser.

---

# 📊 Observability & operational notes

Licia memiliki beberapa titik observability sederhana di level aplikasi.

### Build/runtime

```bash
npm run build
npm run health
pm2 status
pm2 logs licia
pm2 logs licia-reminder-worker
```

### AI

Runtime mencatat informasi seperti:

- fallback model,
- circuit breaker,
- unsupported generation parameter retry,
- completion truncated oleh token limit.

### Reminder

Worker mencatat setiap tick dispatcher dengan timestamp dan status HTTP/body.

### Sync

Sync conflict dipisahkan dari local offline queue sehingga perubahan yang benar-benar bertabrakan dapat ditinjau pengguna.

---

# 🗂️ Database & data ownership

Licia menerapkan pola ownership:

```text
auth.users
    ↓
public.users
    ↓
user-owned tables
```

Hampir semua domain memiliki `user_id` dan policy RLS sendiri.

Contoh tabel/domain yang digunakan source saat ini meliputi:

```text
users
accounts
expenses
incomes
budgets
subscriptions

areas
projects
goals
goal_milestones
tasks
subtasks
schedule_blocks
pomodoro_sessions
habits
habit_checkins

smart_inbox_items
notes
memory
vault
reading_logs
reading_sessions
skills

health_metrics
sleep_logs
hydration_logs
meal_logs
movement_logs

reminders
notification_events
push_subscriptions

ai_action_history
ai_pending_actions
ai_action_plans
ai_watchers
ai_what_if_runs
ai_insight_feedback
ai_chat_messages

sync / conflict related tables
automation related tables
```

Nama/kolom dapat bertambah melalui migration baru; jangan mengasumsikan schema statis hanya berdasarkan daftar README.

---

# 🧱 Prinsip pengembangan

## 1. Jangan pecahkan domain untuk fitur kecil

Fitur baru sebaiknya menggunakan domain service/context/tool yang sudah ada bila memungkinkan.

## 2. Server adalah sumber kebenaran untuk mutation

UI boleh optimistic/offline, tetapi hasil akhir mutation harus diverifikasi pada server saat sinkronisasi memungkinkan.

## 3. AI harus dapat diaudit

Setiap mutation AI yang penting idealnya memiliki jejak action, result, atau snapshot yang memungkinkan pengguna memahami apa yang terjadi.

## 4. Jangan simpan secret di frontend

Service role, cron secret, VAPID private key, dan API key adalah server-side secrets.

## 5. Mobile adalah first-class citizen

UI harus tetap dapat dipakai pada portrait/landscape tanpa overflow yang tidak disengaja.

## 6. Perubahan besar harus melalui migration + verification

Untuk perubahan database:

```text
Code
  +
Migration
  +
Test / verify
  +
Build
```

## 7. Hindari fitur duplikat

Licia mempunyai banyak modul. Fitur baru sebaiknya memperkuat workflow yang ada daripada membuat halaman lain dengan fungsi yang sama.

---

# 📌 Release v0.57.1

`v0.57.1` fokus pada stabilitas build di lapisan aplikasi.

Perubahan utama yang tercatat:

- perbaikan direktif client pada `app/global-error.tsx`,
- perbaikan penggunaan `components/v36/AIModeGuide.tsx` agar sesuai dengan client-side language context,
- kompatibilitas build tetap dijaga pada Next.js 16.3.6 / TypeScript 5.9.

`v0.57.0` membawa beberapa upgrade besar:

- bilingual Indonesia/English,
- smart chips pada Inbox/Notes/Calendar,
- command palette yang lebih kuat,
- focus trap untuk overlay/sheet/modal,
- overlay + z-index system yang konsisten,
- minimum typography floor,
- undo pada lebih banyak quick actions,
- onboarding checklist,
- dashboard customization,
- drag-and-drop task views,
- WCAG AA contrast audit,
- keyboard list shortcuts.

---

# 🧭 Roadmap pengembangan

Arah pengembangan Licia berfokus pada kualitas integrasi, bukan sekadar menambah jumlah halaman.

```text
Phase A
  UI / UX / i18n
       ↓
Phase B
  Reliable AI + Tool Calling
       ↓
Phase C
  Sync + Offline + Conflict Resolution
       ↓
Phase D
  Reminder + Push + Event-driven automation
       ↓
Phase E
  Proactive Intelligence + Knowledge
       ↓
Phase F
  Deeper personalization + observability
```

Prioritas yang sehat untuk perubahan berikutnya:

1. reliability,
2. data correctness,
3. AI safety,
4. mobile UX,
5. performance,
6. observability,
7. baru kemudian fitur baru.

---

# 🤝 Kontribusi

Sebelum membuat perubahan:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Untuk perubahan i18n:

```bash
npm run i18n:check
```

Untuk perubahan accessibility/theme:

```bash
npm run a11y:contrast
```

Untuk perubahan AI:

```bash
npm run eval
npm run test:ai-ux
```

### Checklist pull request

```text
[ ] Tidak ada secret
[ ] Tidak merusak mobile
[ ] Tidak memecahkan i18n
[ ] TypeScript bersih
[ ] Lint bersih
[ ] Regression test relevan berjalan
[ ] Migration database disertakan jika perlu
[ ] Dokumentasi diperbarui jika behavior berubah
```

---

# 📚 Dokumentasi internal yang paling penting

| File | Kegunaan |
|---|---|
| `.env.example` | daftar environment terbaru |
| `CHANGELOG.md` | riwayat perubahan versi |
| `DEPLOY_VPS.md` | panduan deployment server |
| `package.json` | scripts, dependency, engine |
| `ecosystem.config.cjs` | proses PM2 web + reminder worker |
| `scripts/setup-push.mjs` | generate VAPID + cron secret |
| `scripts/reminder-worker.mjs` | reminder worker |
| `scripts/reminder-cron.mjs` | alternatif scheduler |
| `scripts/healthcheck.mjs` | health probe |
| `scripts/preflight.mjs` | validasi environment/build |
| `next.config.js` | security headers + runtime config |
| `lib/ai/modelRouter.ts` | AI model selection |
| `lib/ai/runtime.ts` | AI generation, retry, fallback |
| `lib/ai/tools.ts` | tool definitions |
| `lib/ai/contextEngine.ts` | context selection |
| `lib/reminders/` | reminder scheduling |
| `lib/notifications/` | notification/push |
| `lib/sync/` | sync/conflict |
| `lib/crypto/vaultCrypto.ts` | Vault encryption |
| `supabase/schema_all.sql` | baseline schema |
| `supabase/schema_ai_chat_history.sql` | server chat history |

---

# 🧾 Lisensi

Project ini menggunakan konfigurasi repository internal/private sebagaimana diatur oleh pemilik project. Tambahkan file lisensi terbuka hanya bila project memang akan dipublikasikan dengan lisensi tersebut.

---

# 🌙 Penutup

Licia dirancang sebagai sistem pribadi yang menyatukan **capture, organize, understand, decide, dan act**.

```text
┌──────────────────────────────────────────────┐
│                  YOUR LIFE                   │
├──────────────────────────────────────────────┤
│ Capture      →  ide, input, inbox             │
│ Organize     →  task, project, goal           │
│ Schedule     →  calendar, focus, reminder     │
│ Understand   →  analytics, insights, AI       │
│ Remember     →  memory, notes, vault          │
│ Improve      →  review, learning, wellbeing   │
│ Automate     →  events, reminders, actions    │
└──────────────────────────────────────────────┘
```

> **Licia bukan sekadar tempat menyimpan data. Licia adalah lapisan operasional di atas data kehidupan pribadi Anda.**

<p align="center">
  <strong>🌙 Licia — Your life, connected.</strong>
</p>
