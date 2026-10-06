## 0.57.0 — "Rapi dan dua bahasa" (Kategori A: UI/UX)

**Dwibahasa penuh (A11)**
- Seluruh antarmuka kini tersedia dalam **Bahasa Indonesia dan English**: ±2.600 teks (halaman, toast, dialog, chip cerdas, keadaan kosong, pesan galat API yang tampil di UI, Panduan, nama kontrol). Kunci kamus = teks Indonesia apa adanya (`t("Tugas dibuat")`), padanan Inggris di `lib/locales/en.ts`; teks yang belum diterjemahkan jatuh ke Indonesia, tidak pernah kosong.
- **Bahasa berlaku seketika** dari Pengaturan, palet perintah (`> bahasa`), atau pintasan; disimpan di `localStorage` **dan cookie** `licia-language` sehingga komponen server (SSR) langsung merender bahasa yang benar tanpa kedipan; `<html lang>` ikut berubah.
- Tanggal, jam, dan angka mengikuti locale (`id-ID` / `en-US`): Rp 47.000 ↔ Rp 47,000; label chip "Besok" ↔ "Tomorrow"; parser tetap memahami masukan ID **dan** EN.
- **AI membalas sesuai bahasa antarmuka**: chat, rencana harian, planner mingguan, dan triase Inbox menerima arahan bahasa dari cookie; argumen alat (ISO date, enum) tidak berubah.
- `node scripts/i18n.mjs check` (dipasang di CI dan `npm test`) **gagal bila ada teks UI baru tanpa terjemahan Inggris**; `missing` dan `unused` membantu perawatan kamus.

**A1 — Smart chips di mana-mana**
- Inbox, Catatan, dan Kalender kini menampilkan chip tanggal/jam/prioritas/tag/nominal. Nominal menawarkan **"Catat sebagai pengeluaran / pemasukan"** (tebakan arah dari kata kunci; hanya menyimpan setelah diklik). Inbox/Catatan: **"Jadikan tugas"**. Kalender: **"Isi tanggal & jam dari judul"**.

**A2 — Palet perintah jadi palet aksi**
- Satu palet (`Ctrl/⌘+K`) menggantikan Pusat Perintah + QuickSearch: awalan `>` perintah (tema, bahasa, ukuran teks, sinkronkan, keluar, buat catatan/tugas…), `/` halaman, `?` data lintas modul. **Mengetik teks bebas menawarkan "Buat tugas: …"** dengan smart parsing dan Urungkan.

**A3/A4 — Satu komponen overlay**
- `components/ui/Overlay.tsx` dipakai semua dialog, sheet, dan palet: **perangkap fokus**, fokus kembali ke pemicu, hanya overlay teratas yang merespons Esc, scroll dikunci, latar dibuat `inert`, dirender lewat portal.
- **Skala z-index bertoken** (`lib/zIndex.ts`: `z-nav` … `z-toast`); tak ada lagi nilai 80/105/110/9998/9999 yang tersebar.

**A5/A10 — Keterbacaan**
- Tidak ada lagi teks 8–10 px: semua memakai `text-2xs` (11 px, berbasis **rem**) dan ikut skala teks. Pengaturan > **Ukuran teks** (Kecil / Normal / Besar / Sangat besar) mengubah ukuran dasar seluruh aplikasi.
- **Kontras WCAG AA terjamin**: warna aksen dipecah menjadi *isian* (tombol, teks putih di atasnya ≥ 4,5:1) dan *tinta* (teks/ikon di atas latar). Aksen kustom diturunkan otomatis; `success`/`danger` ikut diperbaiki. Dicakup tes untuk semua preset aksen × semua latar.

**A6 — Urungkan**
- Selesai/ubah status/pindah tugas menampilkan toast **Urungkan (5 dtk, juga `Ctrl/⌘+Z`)**. Hapus tugas **ditunda 5 dtk** (item disembunyikan; komit dijalankan otomatis bila tab ditutup). Toast berhenti menghitung mundur saat disorot/difokus.

**A7 — Onboarding**
- Checklist 5 langkah di Beranda (nama, tugas, catatan, target/proyek, transaksi) dengan **contoh yang bisa diklik** yang membuka Simpan Cepat terisi. Keadaan kosong di Tugas, Inbox, Catatan, dan Keuangan juga menyertakan contoh klik.

**A8 — Beranda bisa diatur**
- **Atur beranda**: tampil/sembunyi dan urutan 9 bagian (tombol naik/turun, ramah keyboard) serta mode **"Hari ini saja"**. Tersimpan lokal dan ikut tersinkron lewat preferensi.

**A9/A12 — Tugas**
- Tampilan baru: **Kanban**, **Matriks Eisenhower** (penting = prioritas tinggi; mendesak = ≤ 48 jam), dan **Pekan** dengan seret-lepas. Setiap kartu punya pilihan **"Pindahkan ke…"** (alternatif non-seret, WCAG 2.5.7). Semua pemindahan bisa diurungkan.
- Pintasan daftar tugas: `J`/`K` pindah, `X` selesai, `E` ubah, `Enter` buka, `#` hapus.

**Kualitas**
- +86 asersi vitest (kontras, overlay/undo, tampilan tugas, tata letak dashboard, onboarding, palet, i18n/format/catat nominal); skrip regresi `scripts/test-v57.mjs`.
- Semua skrip regresi lama menghasilkan kode keluar yang sama seperti 0.56.1.
- Catatan migrasi: tidak ada migrasi database. Pengguna lama dengan aksen kustom otomatis diturunkan token kontrasnya saat pertama dibuka.

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
