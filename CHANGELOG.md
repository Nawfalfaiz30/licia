# Changelog

## 0.57.1
- Fix build: `app/global-error.tsx` — direktif `"use client"` kembali ke baris pertama.
- Fix build: `components/v36/AIModeGuide.tsx` dipakai dari halaman klien, jadi kini komponen klien (`useLanguage`), bukan memakai `next/headers`.

## 0.57.0 — "Dwibahasa penuh & UI yang lebih cekatan" (Kategori A)

**A11 · Dwibahasa penuh (Indonesia/English)**
- Seluruh teks antarmuka (±2.300 string di 100+ berkas) kini lewat `tr()`; kamus Inggris di `lib/i18n/en.ts` dibangun dari `i18n-src/en.json` (`npm run i18n:build`). Teks tanpa padanan tampil apa adanya, tidak pernah kosong.
- Bahasa disimpan di **cookie** `licia-language` + localStorage, sehingga halaman server (Beranda, dll.) dan API (`/api/chat`, `/api/search`) ikut berbahasa pengguna tanpa kedip. `<html lang>` benar sejak HTML pertama.
- Format tanggal/angka mengikuti bahasa (`locale` dari `useLanguage()`); bentuk jamak lewat `{0:day|days}`.
- Prompt sistem Chat memuat bahasa antarmuka; Licia membalas dalam bahasa pengguna.
- Alat CI: `npm run i18n:check` (kunci tanpa terjemahan, placeholder tidak cocok, `tr()` literal baru yang belum diterjemahkan).

**A1 · Smart chips di mana-mana** — Inbox, Catatan, dan Kalender menampilkan chip tanggal/jam/prioritas/tag/nominal; chip nominal menawarkan **Catat sebagai pengeluaran** (dengan Urungkan). Label chip mengikuti bahasa.
**A2 · Palet perintah aksi** (`Ctrl/⌘+K`): `t teks` buat tugas, `i teks` ke Inbox, `$ teks` catat pengeluaran, `> perintah` (tema, bahasa, simpan cepat, fokus), plus pencarian lintas modul. Semua aksi bisa diurungkan.
**A3 · Perangkap fokus** untuk semua dialog/sheet/palet (`OverlayGuard`): fokus masuk, Tab berputar, fokus kembali ke pemicu.
**A4 · Overlay terpadu** — komponen `Overlay` + skala **z-index bertoken** (`z-modal`, `z-sheet`, `z-toast`, …). Toast kini selalu di atas dialog.
**A5 · Teks minimum 11px** (lantai tipografi global; ikut skala teks pengguna).
**A6 · Urungkan** pada selesai/hapus tugas, pindah papan/matriks/minggu, dan semua aksi cepat palet/chip (`notifyUndo`).
**A7 · Checklist onboarding 5 langkah** dengan progres, langkah berikutnya disorot, dan bisa diciutkan (sebelumnya komponen tak terpasang dan hanya menampilkan 4 dari 6 item).
**A8 · Dashboard bisa disesuaikan** — urutan, tampil/sembunyi per bagian, dan mode **Hari ini saja** (cookie, dirender server tanpa kedip).
**A9 · Tugas: seret-dan-lepas** pada Papan, **Matriks Eisenhower**, dan **Minggu**; setiap kartu juga punya menu "Pindahkan ke…" (keyboard & layar sentuh).
**A10 · Kontras WCAG AA** — aksen pilihan pengguna otomatis disesuaikan (gelap/terang) agar terbaca; warna teks di atas aksen dipilih otomatis. `npm run a11y:contrast` menguji 98 kombinasi tema (gagal = CI merah).
**A12 · Pintasan daftar**: `J/K` (↑/↓) pindah, `X` selesai/arsip, `E` ubah, `Enter` buka — di Tugas, Inbox, Catatan.

**Catatan upgrade:** tidak ada migrasi basis data. Pengguna lama otomatis mendapat cookie bahasa dari pilihan sebelumnya.

## 0.56.1
- Fix: permintaan massal (mis. "atur pengingat sesuai semua agenda") yang menunggu konfirmasi tidak lagi dilaporkan sebagai gagal. Recovery dan "final honesty guard" kini dilewati saat ada pendingBulkAction/pendingAction baru, sehingga tidak ada lagi pesan "Agenda tidak ditemukan" palsu sebelum perubahan disetujui.
- Fix: SSE chat berhenti menulis setelah klien membatalkan koneksi (mengurangi error "destination stream closed early").

# Changelog

## 0.56.0 — "Pintar dan nyaman"

**UI/UX**
- **Smart chips di Simpan Cepat** (mode Tugas): tanggal, jam, prioritas, dan nominal dikenali langsung di perangkat saat mengetik ("kirim laporan besok jam 7 malam !1") dan tampil sebagai chip sebelum disimpan. Berjalan offline, tanpa AI. Judul tugas otomatis dibersihkan dari penanda; tenggat memakai zona waktu WIB/WITA/WIT.
- **Pintasan keyboard**: `g` lalu huruf untuk pindah halaman (`g d` Beranda, `g c` Chat, `g t` Tugas, …), `n` untuk Simpan Cepat, `?` untuk daftar pintasan. Tidak aktif saat mengetik atau saat dialog modal terbuka.
- **Pusat Perintah (`Ctrl/⌘+K`) bisa dinavigasi keyboard**: ↑/↓/Home/End memilih, Enter membuka (sebelumnya footer menjanjikan Enter, tetapi tidak ada handler-nya). Hasil diurutkan menurut relevansi (awalan label lebih dulu), pola ARIA combobox/listbox, sorotan mengikuti hover mouse. Logika di `lib/commandPalette.ts`.
- **Aksesibilitas**: dialog Simpan Cepat, Pusat Perintah, dan BottomSheet kini bertanda `role="dialog" aria-modal="true"` dengan tombol tutup berlabel; tautan "Lewati ke konten utama", `<main id="main-content">`, cincin fokus keyboard konsisten (`:focus-visible`, spesifisitas 0 sehingga tidak menimpa gaya komponen), dukungan `forced-colors` dan `prefers-reduced-motion` untuk komponen baru.

**AI**
- **Fallback model otomatis**: `chatCompletionWithFallback()` mengulang permintaan yang sama pada `LICIA_AI_FALLBACK_MODEL` bila model utama gagal karena overload/429/5xx/jaringan/model tidak ditemukan (bukan karena 400/401/403/pembatalan). Dipasang di loop chat, sintesis, dan recovery. Panggilan vision sengaja tidak memakai fallback.
- **Circuit breaker**: 3 kegagalan beruntun → model utama dilewati 60 detik, lalu dicoba lagi (half-open). Pencatatan pemakaian token kini memakai model yang benar-benar menjawab (`completion.model`).

**Kualitas**
- `lib/text/smartParse.ts`: parser tanggal/jam (ID + EN), prioritas, tag, dan nominal Rupiah (`47k`, `1,5jt`, `Rp 12.500`). Konservatif: "Sabtu tanggal 26" yang tidak cocok kalender tidak ditebak.
- Eval golden 10 → 30 kasus (keuangan, transfer, kebiasaan, memori, prompt injection ID/EN, permintaan ambigu "hapus semuanya").
- **Perbaikan eval**: kasus bawaan mengharapkan `create_task` dan melarang `delete_all_tasks`, padahal keduanya tidak ada di `tools.ts` (yang ada: `create_task_with_subtasks`, `delete_tasks_bulk`). Diperbaiki, dan `scripts/eval.mjs` kini gagal bila kasus menyebut nama tool yang tidak dikenal.
- **`npm test` dan `npm run verify` sempat rusak di 0.55.0**: `test-v54.mjs`/`test-v54-2.mjs` mengunci versi ke `0.54.x` dan `verify-v49.mjs` ke `0.52.0`, sehingga gagal di setiap rilis baru. Diganti menjadi pemeriksaan versi minimum.
- `lib/ai/runtime.ts` tidak boleh meng-import modul proyek lain (skrip test memuatnya langsung lewat Node tanpa alias `@/`); fallback membaca env secara lokal.
- +63 asersi vitest: `smartParse` (33), `runtimeFallback` (13), `shortcuts` (7), `commandPalette` (10).

## 0.55.0 — "Cepat dan rapi"

**AI**
- Streaming SSE untuk `/api/chat` (opt-in lewat header `Accept: text/event-stream`; matikan dengan `LICIA_CHAT_STREAM=false`). Event: `status`, `tool_start`, `tool_done`, `final`, `error`. Chat menampilkan status live ("Mencari tugas…") dan tombol Stop.
- System prompt disusun ulang: blok statis di depan, konteks dinamis (tanggal/jam, preferensi, data) di belakang, agar prefix caching bekerja.
- Pertahanan prompt injection: isi catatan/Vault/Inbox diperlakukan sebagai data, bukan perintah.
- Model router mengenali kata kerja kompleks berbahasa Inggris dan mode planner/analyst; ditambah `LICIA_AI_FALLBACK_MODEL` (helper `selectAiFallbackModel`, belum dipasang ke loop chat).
- Batas token adaptif untuk mode planner/analyst (900 token).
- Kuota token harian per pengguna (`LICIA_AI_DAILY_TOKEN_LIMIT`, 0 = nonaktif).
- Eval harness: `evals/golden.json` + `npm run eval`.

**UI/UX**
- `MarkdownLite`: tabel, tautan aman (http/https/mailto), kode inline, checklist, tanpa raw HTML.
- Skeleton per halaman (`components/ui/Skeleton.tsx`, 17 `loading.tsx`).
- Voice capture (Web Speech API, id-ID) di Capture.
- PWA Share Target: menu Bagikan Android mengisi Capture.

**PWA**
- Ikon `any` dan `maskable` dipisah; ikon dikompres (512 px: 443 KB → 79 KB).

**Keamanan**
- Enkripsi sisi klien untuk Vault (AES-GCM, PBKDF2-SHA256 310k iterasi), konten terenkripsi dikeluarkan dari konteks AI, terkunci otomatis saat tab disembunyikan.
- CSP: `'unsafe-eval'` hanya di development; `api.openai.com` dihapus dari `connect-src`.

**Kualitas**
- Vitest + 41 asersi perilaku (`tests/`), GitHub Actions CI (typecheck, lint, test), Prettier.
- `.env.example` lengkap (semua variabel yang dipakai kode).

## 0.54.5

- Memperbaiki type cast retry parameter di `lib/ai/runtime.ts` agar sesuai dengan tipe OpenAI SDK (`unknown` bridge) dan lolos TypeScript.

## 0.54.4

- Fixed TypeScript compatibility for `reasoning_effort` in the centralized AI runtime.
- Routed AI completions through `chatCompletion()` so unsupported generation parameters can be retried safely.
- Kept `temperature` and `reasoning_effort` environment-controlled with typed OpenAI options.

## 0.54.3

- Made AI generation parameters environment-driven and added one-time compatibility retry when `temperature` or `reasoning_effort` is rejected with HTTP 400.
- Applied the generation helper across vision, chat, synthesis, recovery, planner, nutrition, inbox triage, and task assist calls.
- Added `finish_reason === "length"` observability for truncated AI responses.
- Added reminder retry backoff, stale-reminder handling, longer push TTL, `urgency: "high"`, and safer push subscription cleanup.
- Made reminder worker ticks serial and added a 30-second HTTP timeout.
- Hardened cron-secret comparison with `timingSafeEqual`.
- Added missing protected routes to proxy handling and hardened missing-Origin POST/PUT/PATCH/DELETE checks with `Sec-Fetch-Site`.
- Added a public `/privacy` page and moved signed-in privacy controls to `/privacy-center`.
- Added security headers and bounded `next/image` remote patterns to configured origins.
