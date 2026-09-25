# Licia — Connected Personal OS (v12)

Fondasi lengkap: auth, layout responsif desktop/mobile, tema, zona waktu, ekspor data, PWA,
dan asisten AI "Chat Licia". Modul produktivitas dibangun sebagai satu alur: **Capture →
Understand → Plan → Execute → Review**, dengan Tasks, Calendar, Focus, Finance, Health,
Goals, Notes, Reading, Routines, Projects, Memory, Vault, Automations, Timeline, Life Map,
Analytics, Decision Journal, Learning & Skills, Brief, dan Weekly Planner.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Buat project Supabase**, lalu jalankan `supabase/schema_all.sql` di SQL Editor.
   File ini sudah menggabungkan migrasi fase 1–10 dan aman dijalankan ulang untuk instalasi
   yang mengikuti skema ini. Bila ingin memahami perubahan per fase, file `schema_phase*.sql`
   tersedia secara terpisah.

3. **Isi environment variable**
   ```bash
   cp .env.local.example .env.local
   ```
   Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings →
   API di dashboard Supabase), dan `OPENAI_API_KEY`.

4. **Jalankan**
   ```bash
   npm run dev
   ```
   Buka http://localhost:3000

## Checklist tes Fase 1 (jangan lanjut ke Fase 2 sebelum semua ✅)

- [ ] Bisa daftar akun baru (cek email konfirmasi kalau Supabase mewajibkannya, atau
      matikan "Confirm email" di Auth settings untuk dev supaya lebih cepat)
- [ ] Bisa login & logout
- [ ] Setelah login diarahkan ke `/dashboard`, sebelum login diarahkan ke `/login`
- [ ] Sidebar muncul di desktop (≥768px), bottom nav muncul di mobile/viewport sempit
- [ ] Toggle tema light/dark/system bekerja, tidak flicker saat reload halaman
- [ ] Di chat, ketik: `abis beli kopi 25rb` → cek muncul row baru di tabel `expenses`
      di Supabase, dan Licia membalas dengan konfirmasi
- [ ] Ketik: `pengeluaranku bulan ini berapa?` → Licia memanggil `get_expense_summary`
      (bukan mengarang angka) dan menjawab dengan total yang benar-benar cocok dengan
      data di tabel
- [ ] Ketik sesuatu yang ambigu untuk hapus, misal `hapus pengeluaran kopi` saat ada
      lebih dari satu entri kopi → Licia HARUS menampilkan daftar kandidat & bertanya,
      BUKAN menghapus asal atau membuat entri baru
- [ ] Ketik: `catat tugas: kirim laporan besok, dengan subtugas: draft dan review` →
      cek row baru muncul di `tasks` dan `subtasks`
- [ ] Kirim 2-3 pesan berurutan yang saling berkaitan (misal "aku baru beli kopi 25rb"
      lalu "eh salah, harusnya 30rb") → cek Licia paham konteks dari riwayat percakapan
- [ ] Cek tabel `ai_function_call_logs` terisi untuk tiap tool call yang terjadi
- [ ] Dashboard menampilkan angka pengeluaran bulan ini & jumlah tugas terbuka yang
      benar-benar sesuai data, bukan dummy

Kalau semua di atas jalan, lanjut ke checklist Fase 2 di bawah.

## Checklist tes Fase 2

- [ ] Halaman `/tasks`: tambah tugas, centang selesai, centang subtugas, hapus tugas —
      semua langsung ter-refresh dan tersimpan di Supabase
- [ ] Halaman `/pomodoro`: mulai timer, jeda, reset; setelah 25 menit selesai otomatis
      tercatat di `pomodoro_sessions` dan muncul di daftar "Sesi hari ini"
- [ ] Halaman `/calendar`: navigasi hari (◀ ▶), tambah agenda dengan jam mulai/selesai,
      hapus agenda
- [ ] Di chat, ketik: `apa aja tugasku?` → Licia memanggil `get_tasks` (bukan mengarang)
      dan **menyebut namamu** di jawabannya, misal "Kamu (nama) belum punya tugas" atau
      daftar tugas yang benar-benar ada
- [ ] Ketik: `tandai tugas [judul] selesai` → status tugas berubah jadi selesai lewat
      `update_task`, konsisten dengan yang tampil di `/tasks`
- [ ] Ketik: `hapus tugas [kata kunci]` saat ada >1 tugas cocok → Licia menampilkan
      daftar kandidat & bertanya, bukan menghapus asal
- [ ] Ketik: `susunin jadwal besok: meeting jam 9-10, olahraga jam 17-18` → blok baru
      muncul di `/calendar` untuk besok tanpa atribusi teknis yang mengganggu
- [ ] Ketik: `hari ini agendaku apa aja, dan progress fokusku gimana?` → Licia memanggil
      `get_today_overview` dan menjawab dengan data gabungan tugas+jadwal+pomodoro+
      pengeluaran hari itu, bukan potongan-potongan terpisah
- [ ] Dashboard menampilkan 4 stat (pengeluaran, tugas terbuka, fokus hari ini, agenda
      hari ini) sesuai data asli
- [ ] Ganti warna aksen & tema lewat halaman **Pengaturan** (`/settings`, bisa diakses
      dari sidebar desktop maupun bottom nav mobile) → berubah di seluruh UI dan tetap
      tersimpan setelah reload
- [ ] Toggle dark/light tetap tidak flicker meski warna aksen custom sudah dipilih
- [ ] Avatar Licia (bukan huruf "L") muncul di sidebar & di bubble chat

Kalau semua di atas jalan, lanjut ke checklist Fase 3 di bawah.

## Perbaikan penting (baca sebelum lanjut)

1. **Nama panggilan tidak tersimpan/tidak dipakai Licia.** Akar masalahnya: insert
   profil sempat dilakukan dari client tepat setelah `signUp()`, padahal kalau project
   Supabase-mu mewajibkan konfirmasi email, saat itu belum ada sesi login aktif —
   `auth.uid()` masih `null`, jadi RLS diam-diam menolak insert. Solusinya sekarang
   pakai **trigger database** (`fix_auto_profile.sql`) yang membuat baris profil
   otomatis saat akun auth dibuat, tidak bergantung sesi sama sekali. Ada juga fallback
   self-healing di `lib/getOrCreateProfile.ts` untuk akun lama yang terlanjur tidak
   punya baris profil.
2. **Kontrol tema/warna aksen tidak kelihatan.** Sebelumnya kontrol ini hanya ada di
   sidebar desktop yang otomatis tersembunyi di layar sempit/mobile — jadi kalau kamu
   buka di HP, memang tidak ada cara mengaksesnya. Sekarang semua pindah ke halaman
   **Pengaturan** (`/settings`) yang muncul di navigasi baik desktop maupun mobile.

## Checklist tes Fase 3

- [ ] Halaman `/finance` tab "Transaksi": tambah pengeluaran cepat, hapus transaksi
- [ ] Halaman `/finance` tab "Anggaran": buat anggaran per kategori, progress bar
      terisi sesuai pengeluaran nyata di kategori itu, berubah warna merah kalau lewat
      limit, hapus anggaran
- [ ] Halaman `/health`: catat hidrasi/kafein/makan/obat lewat kartu masing-masing,
      pilih skor kelelahan → semua muncul di "Riwayat hari ini"
- [ ] Di chat, ketik: `dapet gaji 3 juta` → tercatat di tabel `incomes`
- [ ] Ketik: `bikin anggaran makanan 1 juta per bulan` → muncul di `/finance` tab
      Anggaran dengan progress sesuai pengeluaran kategori "makanan" bulan ini
- [ ] Ketik: `budgetku gimana?` → Licia memanggil `get_budgets` dan melaporkan progres
      tiap anggaran dengan angka yang benar-benar cocok dengan `/finance`
- [ ] Ketik: `abis minum air 500ml` dan `tadi minum kopi item` → tercatat di
      `hydration_logs`/`caffeine_logs`, muncul juga di halaman `/health`
- [ ] Ketik: `hapus anggaran makanan` saat hanya ada satu → Licia tetap menampilkan
      calon kandidat & minta konfirmasi dulu (bukan langsung hapus)

Kalau semua di atas jalan, lanjut ke **Fase 4** (Jurnal, Catatan, Bacaan, Relasi, Kebiasaan).

## Checklist tes upgrade (setelah Fase 3)

- [ ] Di chat, balasan Licia yang mengandung **teks tebal** tampil sebagai bold asli,
      bukan tanda bintang mentah
- [ ] Dashboard tidak lagi menampilkan kotak chat — ada tombol "Bareng Licia" ke `/chat`,
      dan dua daftar baru: "Tugas mendesak" & "Agenda hari ini" berisi data asli
- [ ] Nav "Ngobrol"/"Curhat" sudah berganti jadi "Bareng Licia" di sidebar & bottom nav
- [ ] `/calendar`: bisa pindah antara tampilan Hari/Minggu/Bulan; di Minggu & Bulan ada
      titik penanda di tanggal yang punya agenda; klik tanggal memuat agenda hari itu
      di bawah
- [ ] `/tasks`: klik "Tambah detail" memunculkan field prioritas/tenggat/deskripsi;
      tugas bisa diklik untuk expand (lihat deskripsi & tambah subtugas manual); ada
      tombol edit untuk mengubah tugas yang sudah ada
- [ ] `/pomodoro`: durasi fokus/jeda pendek/jeda panjang bisa diubah; sesi otomatis
      berpindah ke jeda setelah fokus selesai (jeda panjang tiap 4 siklus default);
      bisa pilih tugas terkait sebelum mulai fokus, dan nama tugas itu muncul di
      riwayat sesi
- [ ] `/finance` tab "Ringkasan": sisa saldo, pemasukan/pengeluaran bulan ini, dan
      grafik batang kategori pengeluaran terbesar sesuai data asli
- [ ] `/finance` tab "Dompet": tambah dompet dengan saldo awal, saldo berjalan
      (`saldo awal + pemasukan - pengeluaran di dompet itu`) terhitung benar, hapus
      dompet
- [ ] `/finance` tab "Transaksi": form sekarang bisa catat pengeluaran ATAU pemasukan
      (toggle di atas form), dengan pilihan dompet opsional
- [ ] Di chat, ketik: `sisa uangku berapa?` → Licia memanggil `get_net_worth`, angkanya
      cocok dengan tab Ringkasan
- [ ] Ketik: `bikin dompet BCA saldo awal 500rb` → muncul di tab Dompet
- [ ] Ketik: `catat tugas: revisi laporan, deskripsinya cek data Q3 dulu, prioritas
      tinggi, deadline besok jam 5 sore` → tugas baru di `/tasks` punya deskripsi,
      prioritas, dan tenggat yang benar

## Perbaikan sesi ini (baca sebelum lanjut ke Fase 4)

1. **Bug tanggal/timezone di Kalender.** Kode lama pakai
   `tanggal.toISOString().slice(0, 10)` untuk mendapat label "YYYY-MM-DD" — ini SALAH
   untuk timezone WIB (UTC+7) karena `toISOString()` mengonversi ke UTC dulu, jadi bisa
   geser satu hari (persis bug yang kamu screenshot: agenda nyangkut di tanggal yang
   salah). Diperbaiki dengan util `lib/date.ts` (`localDateStr`) yang dipakai konsisten
   di kalender, dashboard, tugas, dan semua tool AI yang berurusan dengan "hari ini".
2. **AI kadang salah taruh Tugas vs Kalender.** System prompt sekarang punya aturan
   eksplisit: ada jam spesifik acara berlangsung → Kalender; perlu dicentang selesai
   (walau ada tenggat) → Tugas. AI juga diinstruksikan menghapus & memindahkan entri
   yang salah tempat kalau dikoreksi, bukan membiarkan data nyangkut di dua tempat.
3. **Riwayat chat** disimpan lokal dan dipangkas agar ringan. Tool-call internal tidak menjadi isi riwayat yang dikirim ulang; state penghapusan yang menunggu konfirmasi disimpan terpisah secara ringkas.
4. **Nama "Curhat" → "Bareng Licia"**, dan navigasi mobile dirombak: bottom nav cuma
   4 menu utama (Beranda, Bareng Licia, Tugas, Kalender) + tombol "Lainnya" yang buka
   sheet berisi sisanya, dikelompokkan per kategori — supaya tidak berantakan walau
   menu terus bertambah.

## Checklist tes Fase 4

- [ ] `/goals`: tambah target dengan judul + tanggal target (opsional), geser slider
      progres → progress bar & persen ter-update, sampai 100% otomatis tercoret/selesai
- [ ] `/notes`: tulis catatan + tag (pisah koma), filter berdasarkan tag berfungsi
- [ ] `/reading`: tambah judul + penulis manual (tanpa sampul/gambar), geser slider
      progress → status otomatis berubah (ingin dibaca/sedang dibaca/selesai)
- [ ] `/life-map`: lihat node Target, Project, Tugas, Kalender, Smart Inbox, dan Focus;
      pastikan sinyal gap seperti target tanpa project atau project tanpa tugas muncul
- [ ] `/habits` (judul halaman "Rutinitas"): tambah kebiasaan dengan target per
      minggu, centang hari ini → progress minggu & "hari beruntun" (streak) benar,
      dan rutinitas yang sudah dicentang/belum muncul juga di dashboard
- [ ] Di chat, ketik: `aku mau nabung buat laptop baru` → masuk ke `/goals`
- [ ] Ketik: `tambahin buku Laut Bercerita ke bacaan` → muncul di `/reading` (tanpa
      mencoba mengambil gambar sampul)
- [ ] Ketik: `jelaskan hubungan target, project dan tugasku` → Licia memakai konteks
      domain yang relevan dan tidak mencoba memanggil tool Relations lama
- [ ] Ketik: `aku abis makan nasi padang rendang telur` → cek di `/health`, muncul
      estimasi kalori/protein/karbo/lemak
- [ ] Di halaman `/health`, catat makanan lewat form manual (tombol "Catat") → tombol
      berubah jadi "Menghitung..." sebentar, lalu estimasi gizi tetap muncul (BUKAN
      cuma yang dicatat lewat chat)
- [ ] Ketik: `checkin kebiasaan lari hari ini` → tercentang di `/habits`
- [ ] Coba pindah dari `/chat` ke halaman lain lalu balik lagi → riwayat percakapan
      masih ada (tidak hilang begitu saja)
- [ ] Buat agenda kalender lewat chat dengan menyebut lokasi (mis. "rapat jam 2 siang
      di kantor pusat") → lokasi masuk ke field lokasi terpisah, bukan digabung ke
      judul; cek juga tanggalnya PAS sesuai yang diminta (bukan geser satu hari)

## Perbaikan sesi ini (putaran 2 — baca sebelum lanjut ke Fase 5)

1. **Konfirmasi hapus AI diperkuat.** State kandidat yang sedang menunggu konfirmasi sekarang
   disimpan sebagai objek kecil terpisah dari riwayat tool, sehingga pesan "iya" dapat langsung
   meneruskan ID kandidat ke tool delete tanpa membawa seluruh tool history ke prompt.
2. **Dashboard**: kartu "Sisa saldo" sekarang lebih lebar (tidak kepotong lagi), kartu
   "Bulan ini" menampilkan Pengeluaran & Pemasukan (sebelumnya salah menampilkan sesi
   fokus dua kali), dan rutinitas hari ini sekarang ikut ditampilkan.
3. **"Bareng Licia" → "Chat Licia"**.
4. **Jurnal diganti Target.** Jurnal (mood diary) dan Catatan (tulisan bebas) memang
   tumpang tindih fungsinya — sekarang diganti fitur **Target**: hal yang ingin
   dicapai/ditabung/dibeli dengan progres 0-100% dan tanggal target opsional, jelas
   beda dari Tugas (checklist sekali selesai), Kebiasaan (rutin berulang), dan Catatan
   (tulisan bebas tanpa struktur). Tabel `journal_entries` lama di database dibiarkan
   ada (data tidak dihapus paksa), hanya sudah tidak dipakai aplikasi.
5. **Kesehatan**: form manual "Catat" makanan sekarang juga memanggil AI untuk
   estimasi gizi (lewat endpoint kecil `/api/estimate-nutrition`), tidak lagi
   dibedakan dari pencatatan via chat. Caption yang membingungkan sudah dihapus.
6. **Bacaan**: fitur sampul/cover dihapus total (tidak ada lagi pemanggilan gambar
   dari Open Library) — form sekarang cuma judul + penulis, lebih ringan.
7. **Pengaturan**: warna aksen & warna latar berubah langsung begitu kamu klik
   preset atau ketik hex — tidak ada tombol "Terapkan" (lihat juga catatan putaran 3
   di bawah, ini sempat berubah-ubah pola UX-nya). Ditambah opsi kustomisasi warna
   latar belakang (preset gelap/terang + hex sendiri), bukan cuma warna aksen.
8. **SQL tidak aman dijalankan ulang.** `create policy` di Postgres TIDAK mendukung
   `if not exists`, beda dari `create table`. Kalau file SQL dijalankan dua kali,
   errornya persis seperti yang mungkin kamu temui: `policy "..." already exists`.
   Semua file sekarang diperbaiki pakai pola `drop policy if exists ... ; create
   policy ...` supaya aman dijalankan ulang kapan saja. Juga ditambahkan
   `supabase/schema_all.sql` yang menggabung semua migrasi jadi satu file urut,
   supaya tidak perlu lagi jalankan satu-satu manual.

## Perbaikan sesi ini (putaran 3)

1. **Build error (syntax error) di `lib/ai/systemPrompt.ts`.** Ada tanda backtick
   (`` ` ``) di dalam teks yang ditulis di dalam template string yang JUGA pakai
   backtick sebagai pembatas — itu menutup string-nya lebih awal secara tidak
   sengaja, persis error yang kamu screenshot. Sudah diganti pakai tanda kutip
   biasa. Sudah dicek juga ke SEMUA file lain di proyek untuk memastikan tidak ada
   bug serupa yang tersembunyi.
2. **Warna aksen & latar: tombol "Terapkan" dihapus.** Sekarang klik warna atau
   ketik kode hex langsung berubah saat itu juga, tidak perlu klik tombol apa pun.
3. **Warna latar tidak ikut ganti otomatis saat pindah mode terang/gelap — bug
   nyata, sudah diperbaiki.** Akar masalahnya: warna latar custom disimpan di SATU
   key yang sama untuk kedua mode, jadi begitu kamu kustomisasi warna latar di mode
   gelap lalu pindah ke terang, warna gelap itu "kebawa". Sekarang warna latar
   disimpan **terpisah per mode** (`licia-bg-light-hex` & `licia-bg-dark-hex`), dan
   `ThemeToggle` otomatis menerapkan warna yang sesuai setiap kali mode diganti.
4. **Font bisa diatur.** Halaman Pengaturan sekarang punya pemilih font judul
   (Fraunces/Playfair Display/Poppins) dan font isi (Plus Jakarta Sans/Inter/
   Nunito), dengan pratinjau langsung di setiap pilihan. Semua font dimuat
   sekaligus lewat `next/font` (tetap di-hosting sendiri, tidak ada request
   tambahan ke Google saat pengguna ganti pilihan), jadi perpindahannya instan.

## Perbaikan sesi ini (putaran 4)

1. **Balasan Licia rapi lagi.** Screenshot kamu menunjukkan `### Pengeluaran:` tampil
   MENTAH (tanda pagar ikut kelihatan) — itu karena `MarkdownLite` (perender markdown
   ringan di bubble chat) belum menangani heading sama sekali. Sekarang heading
   dirender sebagai teks tebal biasa tanpa tanda pagar. System prompt juga diperkuat
   dengan contoh salah/benar eksplisit supaya Licia sendiri lebih jarang memakai
   heading di balasan santai (bubble chat, bukan dokumen).
2. **CRUD lengkap untuk SEMUA data — sebelumnya banyak yang bolong.** Diaudit satu
   per satu, ternyata banyak entitas cuma punya sebagian dari create/read/update/
   delete. Tool baru yang ditambahkan (18 tool):
   `update_expense`, `get_incomes`, `update_income`, `update_account`,
   `get_pomodoro_sessions`, `delete_pomodoro_session`, `delete_health_log`,
   `update_note`, `update_habit`, `uncheckin_habit`, `delete_subtask`,
   `get_interactions`, `delete_interaction` — total sekarang **58 tool**, semua
   tersambung (dicek otomatis, tidak ada yang bolong atau duplikat). System prompt
   juga ditambah aturan: pakai `update_*` untuk koreksi data, jangan hapus-lalu-buat-
   ulang (supaya tidak kehilangan data lain di entri yang sama, mis. catatan/tanggal
   asli).
3. **Upgrade fitur Personal:**
   - **Catatan**: sekarang bisa diedit langsung (isi & tag), bukan cuma hapus-buat-baru
   - **Bacaan**: rating bintang (1-5) & catatan pribadi per buku — kolomnya sudah ada
     di database sejak awal tapi belum dipakai UI-nya
   - **Relasi**: riwayat interaksi bisa dilihat & dihapus per kontak (klik nama/panah
     untuk expand), tanggal lahir bisa diisi & muncul badge kalau kurang dari 30 hari
     lagi, dan sekarang bisa diedit (nama/prioritas/frekuensi) tanpa hapus-buat-ulang
   - **Kebiasaan/Rutinitas**: bisa diedit (nama/target mingguan) langsung dari kartu
   - **Target**: tambah catatan/rencana per target (kolom deskripsi yang sebelumnya
     ada di database tapi belum dipakai UI-nya)

## Fase 5 → diganti Langganan (lihat "Perbaikan sesi ini (putaran 5)")

Modul Anime/Manga (Jikan) yang sempat dibangun di Fase 5 sudah **dihapus** dan
diganti fitur Langganan (subscription tracker) — lihat catatan putaran 5 di bawah.
Tabel `jikan_cache` dan `anime_watchlist` dibiarkan ada di database (tidak dihapus
paksa), hanya sudah tidak dipakai aplikasi. Kalau suatu saat ingin fitur semacam ini
lagi, pola resilience-nya (`fetchJikanCached`, cache-fallback, dst — prinsipnya, bukan
kodenya yang sudah dihapus) tetap bisa dicontoh untuk API publik lain yang serupa.

## Perbaikan sesi ini (putaran 7)

1. **Error `Cannot read properties of undefined (reading 'split')` di
   `MarkdownLite.tsx`.** Sudah dicek: kode saat ini SUDAH punya penjaga
   (`text ?? ""`) untuk kasus ini — error di screenshot kamu berasal dari zip
   lama sebelum perbaikan itu ada. Pastikan pakai zip terbaru ini.
2. **Paste gambar dengan Ctrl+V** — sekarang bisa. Screenshot atau gambar hasil
   copy dari aplikasi lain langsung terlampir ke chat begitu di-paste di kotak
   teks, sama seperti klik tombol 📎.
3. **AI salah jawab jam sekarang** (mis. jam asli 19:56 dijawab 00:56) — akar
   masalahnya: system prompt Licia cuma punya TANGGAL, sama sekali tidak punya
   JAM. Jadi kalau ditanya "jam berapa sekarang?", dia terpaksa mengarang.
   Sekarang jam sekarang (dalam zona waktu yang kamu atur di Pengaturan) ikut
   dikirim di setiap request, jadi jawabannya akurat.
4. **Ekspor data: JSON → HTML yang enak dibaca.** Sebelumnya file JSON mentah
   susah dibaca terutama di HP. Sekarang `/api/export-data` menghasilkan
   halaman HTML rapi — dikelompokkan per modul, label & format Rupiah/tanggal
   yang manusiawi (bukan `occurred_at: "2026-09-20T13:00:00Z"` mentah), dan bisa
   dibuka langsung di browser HP atau laptop. Bonus: bisa dicetak/disimpan
   sebagai PDF lewat menu print browser kalau perlu salinan fisik/cetak.

### Checklist tes putaran 7

- [ ] Ganti isi project dengan zip terbaru, pastikan error MarkdownLite tidak
      muncul lagi
- [ ] Copy screenshot (mis. tekan PrtScn atau tool screenshot), buka chat
      Licia, klik kotak teks, tekan Ctrl+V → gambar langsung terlampir
- [ ] Tanya Licia "sekarang jam berapa?" → jawabannya cocok dengan jam asli
      di perangkatmu (sesuai zona waktu yang kamu pilih di Pengaturan)
- [ ] Pengaturan → "Unduh semua data saya" → file `.html` terunduh (bukan
      `.json`), buka di HP dan di laptop, cek terbaca rapi di keduanya

## Perbaikan sesi ini (putaran 6)

1. **Kartu "Sisa saldo" pecah aneh saat angkanya panjang** ("Rp 3.000." lalu "000" di
   baris berikutnya). Ditambah `rupiahCompact()` — format ringkas seperti "Rp 3jt"
   khusus untuk kartu sempit ini; angka lengkap tetap ada lewat hover/tap-and-hold
   (atribut `title`). Halaman Keuangan tetap pakai format lengkap seperti biasa.
2. **Chat: Enter untuk baris baru** — ternyata sudah terpasang dari sesi sebelumnya
   (dicek ulang & dikonfirmasi jalan): kotak chat sekarang `<textarea>` auto-tinggi,
   Enter mengirim pesan; editor otomatis menjaga penulisan panjang tetap nyaman.
3. **Upload gambar** — juga sudah terpasang dari sesi sebelumnya, tapi
   ada bagian yang setengah jadi: tool `log_expenses_batch` (catat banyak pengeluaran
   sekaligus dari satu struk, dipisah per barang) sudah punya definisi & instruksi
   lengkap di system prompt, tapi saya cek ulang untuk pastikan handler-nya benar
   tersambung — ternyata sudah, jadi fitur ini SIAP DIPAKAI: lampirkan gambar
   lewat ikon 📎 di chat, Licia baca tiap barang & harganya, catat satu-satu sebagai
   pengeluaran terpisah (bukan digabung jadi satu angka besar).
4. **Catatan menampilkan `###`/`*` mentah dari AI** — halaman Catatan sebelumnya
   menampilkan isi sebagai teks polos apa adanya, jadi kalau Licia menulis dengan
   format markdown, tanda-tandanya ikut kelihatan. Diperbaiki dua arah: (a) halaman
   Catatan sekarang render lewat `MarkdownLite` yang sama dipakai di chat, dan
   (b) instruksi tool `create_note`/`update_note` diperjelas: catatan itu teks
   polos, jangan pakai markdown sama sekali (bukan cuma "jangan heading" seperti di
   chat).

### Checklist tes putaran 6

- [ ] Dashboard: kartu "Sisa saldo" tidak lagi pecah aneh, coba hover/tekan lama
      untuk lihat angka lengkap
- [ ] Di chat, Enter mengirim pesan dan Shift+Enter membuat baris baru
      dalam satu bubble, Enter biasa tetap langsung kirim
- [ ] Lampirkan gambar apa pun (bisa foto asli dari HP) lewat ikon 📎 →
      Licia membalas dengan rincian per barang, cek di `/finance` semua barang
      tercatat terpisah (bukan satu baris gabungan)
- [ ] Minta Licia catat sesuatu ke Catatan → buka `/notes`, pastikan tidak ada
      `#`, `##`, atau `**` yang tampil mentah

## Perbaikan sesi ini (putaran 5)

Ini sesi perbaikan paling besar sejauh ini — banyak bug lama baru ketahuan justru
karena diperiksa lebih dalam gara-gara satu laporan bug jam tugas.

1. **Bug timezone — jauh lebih dalam dari yang terlihat.** Satu laporan "jam 7 malam
   tersimpan jadi jam 2 pagi" ternyata gejala pola yang sama menyebar di **8 lokasi**:
   ada helper `ensureWibOffset` yang sudah ditulis tapi tidak pernah dipanggil (dead
   code), `buildSystemPrompt` menghitung "hari ini" pakai timezone server (bukan
   WIB), dan enam fungsi lain (`getTodayOverview`, `getHealthSummary`,
   `currentPeriodRange`, `getHabits`, `checkinHabit`/`uncheckinHabit`, dashboard)
   semua pakai `setHours(0,0,0,0)` atau `getFullYear()/getMonth()/getDate()` yang
   ikut terpengaruh timezone server. Semua diperbaiki dengan helper baru di
   `lib/date.ts` yang menghitung lewat aritmatika offset murni (`wibDateStr`,
   `wibStartOfDayIso`, `wibStartOfWeekIso`, `wibStartOfMonthIso`) — sudah disapu
   bersih ke seluruh proyek, dicek otomatis tidak ada pola berbahaya tersisa.
2. **Zona waktu sekarang bisa diatur** (Pengaturan → Zona waktu: WIB/WITA/WIT,
   tersimpan di `users.timezone`), dan system prompt AI memakainya secara dinamis
   (bukan hardcode WIB lagi) untuk menghitung "hari ini" dan offset jam yang benar.
   Catatan jujur: `ensureWibOffset` (jaring pengaman kalau AI lupa sertakan offset
   sama sekali) masih fallback ke +07:00 — jadi utamanya pengguna WITA/WIT tetap
   benar SELAMA AI menyertakan offset (yang sekarang diinstruksikan eksplisit &
   dinamis di prompt), residual risiko cuma kalau AI lupa total, kasus yang jauh
   lebih jarang sekarang.
3. **Dashboard**: bug layout kartu "Sisa saldo" yang bikin grid tidak simetris di
   HP (ada `col-span-2` yang tidak perlu, padahal teksnya sudah bisa wrap sendiri)
   sudah dihapus.
4. **Anime/Manga diganti Langganan** — tracker biaya berlangganan (Netflix, Spotify,
   gym, dst) dengan siklus tagihan, tanggal jatuh tempo berikutnya, dan kategori.
   Terasa lebih berguna sehari-hari dan nyambung langsung ke modul Keuangan
   dibanding fitur hobi yang cuma relevan untuk sebagian pengguna.
5. **Kesehatan: "Tingkat kelelahan" diganti tracker tidur.** Skor 1-5 yang vague
   diganti dengan pencatatan jam mulai/bangun tidur (durasi dihitung otomatis),
   kualitas tidur, rata-rata 7 hari, dan grafik batang durasi per malam — jauh
   lebih actionable dan sesuai standar aplikasi kesehatan modern.
6. **Upgrade modul Personal** (bukan diganti — sudah punya nilai unik masing-masing,
   jadi diperdalam):
   - **Target**: tambah kategori (karier, finansial, kesehatan, dst)
   - **Catatan**: bisa disematkan (pin) ke atas
   - **Bacaan**: tambah genre
   - **Rutinitas**: tambah ikon emoji per kebiasaan
   - **Relasi**: tambah kelompok kontak (keluarga/teman/kerja/kenalan/lainnya) +
     filter — dipertimbangkan untuk diganti total, tapi karena sudah punya badge
     overdue & riwayat interaksi yang cukup unik, saya pilih upgrade dulu; kabari
     kalau kamu masih mau diganti sepenuhnya
7. **Google Sign-In (opsional, TIDAK otomatis aktif).** Tombol "Lanjutkan dengan
   Google" sudah ada di halaman login & signup, plus route `/auth/callback`. Supaya
   benar-benar berfungsi, kamu perlu setup eksternal dulu (di luar kode ini):
   1. Buat OAuth Client ID di [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
      (tipe "Web application"), dengan Authorized redirect URI:
      `https://<project-id>.supabase.co/auth/v1/callback`
   2. Di dashboard Supabase → Authentication → Providers → Google, aktifkan dan
      isi Client ID + Client Secret dari langkah 1
   3. Di dashboard Supabase → Authentication → URL Configuration, pastikan Site URL
      dan Redirect URLs mengarah ke domain aplikasimu (termasuk `/auth/callback`)

   Tanpa 3 langkah ini, tombolnya akan gagal/redirect ke error — bukan bug di kode,
   memang butuh konfigurasi provider di luar aplikasi.
8. **Pengaturan bertambah banyak**: zona waktu (poin 2), dan **ekspor data** — tombol
   "Unduh semua data saya (JSON)" mengunduh seluruh catatanmu (tugas, keuangan,
   kesehatan, dst) dalam satu file, lewat `/api/export-data`.

### Checklist tes putaran 5

- [ ] Buat tugas lewat chat dengan jam spesifik (mis. "jam 7 malam") → cek di
      `/tasks` jamnya PAS 19:00, bukan geser
- [ ] Ganti zona waktu ke WITA di Pengaturan, buat tugas lagi dengan jam spesifik
      → cek jamnya tetap benar
- [ ] Buka dashboard di HP → kartu "Sisa saldo" tidak lagi bikin grid asimetris
- [ ] `/subscriptions`: tambah langganan (mis. Netflix, Rp 65.000/bulan), cek
      tanggal jatuh tempo berikutnya masuk akal
- [ ] `/health`: catat hidrasi, gerak, makanan, kafein, dan obat; tidak perlu mengisi metrik fisik untuk memakai modul sehari-hari.
- [ ] `/goals`: tambah kategori ke target, muncul sebagai badge
- [ ] `/notes`: sematkan (pin) satu catatan → pindah ke atas daftar
- [ ] `/reading`: tambah genre ke buku, muncul sebagai badge
- [ ] `/habits`: tambah kebiasaan dengan emoji custom, muncul di kartu
- [ ] `/life-map`: lihat hubungan struktur target, project, tugas, waktu, dan fokus
- [ ] Coba tombol "Lanjutkan dengan Google" di halaman login — kalau belum setup
      provider-nya di Supabase, ini WAJAR gagal (lihat poin 7 di atas)
- [ ] Pengaturan → "Unduh semua data saya" → arsip HTML terbuka rapi dan bisa dicetak/disimpan sebagai PDF.

## Licia v12.1 — Core, AI & UX upgrade

Versi ini berfokus pada tiga fondasi: **core yang lebih terintegrasi**, **AI yang lebih hemat konteks/token**, dan **UX mobile-first**.

- **Relations dipensiunkan dari produk** dan diganti **Life Map**, yaitu peta hubungan Target → Project → Tugas → Kalender/Focus/Inbox. Life Map kini punya **Momentum**, **Attention Debt**, deteksi deadline dekat/terlewat, dan sinyal struktur yang perlu dibereskan. Route `/relations` hanya menjadi redirect kompatibilitas agar bookmark lama tidak rusak.
- **Smart Inbox** sekarang mendukung pencarian/filter, batch AI triage hingga 20 item, dan konversi langsung menjadi tugas/catatan/ide/keputusan/belajar.
- **Memory Licia, Vault, dan Automation Center** diberi penjelasan fungsi yang lebih jelas serta AI tools khusus agar Licia dapat mengambil konteksnya tanpa memakai seluruh database.
- **Projects** dapat menampung tujuan, deadline, status, dan next action melalui tugas yang langsung ditambahkan dari kartu project.
- **Brief & Review** digabung menjadi satu halaman dengan snapshot hari ini, review 7 hari, dan filter bulanan. `/review` diarahkan ke `/brief`.
- **Timeline + Personal Analytics** membaca jejak lintas modul, termasuk target/project/income/subscription/rutinitas selain task/focus/agenda/finance/reading/gerak/inbox.
- **Health** difokuskan ke pencatatan kebiasaan harian yang dapat diamati (hidrasi, gerak, makan, kafein, obat) tanpa mewajibkan metrik fisik/check-up. Data tabel medis lama tetap dipertahankan untuk kompatibilitas, tetapi tidak dipakai UI aktif.
- **Focus** menerima durasi manual 1–240 menit, memiliki pilihan suara selesai (chime/bells/pulse/off), menyimpan preferensi secara lokal/profil, memakai timer berbasis timestamp agar tidak drift saat tab masuk background, dan preset Pomodoro lama `/pomodoro` sekarang diarahkan ke Focus baru.
- **Chat Licia** mendukung penghapusan per giliran di mobile dan desktop, termasuk state konfirmasi hapus AI yang ringan.
- **AI routing** memilih domain + operasi write yang relevan saja, membatasi riwayat, merangkum payload tool besar, memakai konteks lintas-modul yang selektif, dan menggunakan `gpt-4o-mini` dengan batas output agar biaya lebih terkontrol. Konfirmasi hapus disimpan ringan selama 15 menit sehingga tidak perlu mengirim ulang seluruh tool history.
- **Settings** sekarang menyimpan start page, bahasa, timezone, awal minggu (dan benar-benar memengaruhi kalender), durasi/suara Focus, density, reduced motion, dan konfirmasi hapus chat. Terjemahan penuh seluruh halaman belum dipaksakan agar tidak menjadi campuran bahasa; pilihan English saat ini terutama menjadi fondasi locale/core UI.

### Wajib setelah upgrade

Jalankan `supabase/schema_phase11_modern_os.sql` **setelah** `supabase/schema_all.sql` pada project Supabase yang sudah ada. Migrasi ini menambah `users.preferences` dan index yang dipakai oleh upgrade Core/AI/UX. Tidak ada data Relations yang dihapus dari database secara paksa.

### Verifikasi lokal

Parser TypeScript/TSX untuk seluruh file proyek sudah diperiksa tanpa syntax error. Full `next build` belum dapat diverifikasi di environment ini karena dependency npm belum terpasang dan percobaan instalasi sebelumnya tidak selesai; lakukan `npm install` lalu `npm run build` di mesin/VPS pengembangan sebelum deployment.

## Struktur proyek

```
app/
  (auth)/login, (auth)/signup      -- halaman auth (email/password + tombol Google)
  auth/callback/route.ts           -- callback OAuth (Google, dkk)
  (app)/dashboard, chat, tasks,
       pomodoro, calendar,
       finance, subscriptions,
       health, goals, notes,
       reading, habits, life-map,
       projects, planner, brief, timeline, analytics,
       memory, vault, automations, settings                   -- semua dibungkus sidebar/bottom nav
  api/chat/route.ts                -- loop function-calling OpenAI (routing + context selektif)
  api/estimate-nutrition/route.ts  -- estimasi gizi AI untuk form manual Kesehatan
  api/export-data/route.ts         -- ekspor semua data pengguna jadi JSON
lib/
  supabase/client.ts, server.ts    -- client Supabase (browser & server, RLS-aware)
  ai/systemPrompt.ts, tools.ts     -- karakter Licia + tools; toolRouting + context untuk AI selektif
  getOrCreateProfile.ts            -- self-healing fallback profil pengguna
  theme.ts                         -- util warna aksen/latar/font (per-mode aware)
  date.ts                          -- util tanggal aman-timezone: localDateStr (client),
                                       wibDateStr/wibStartOf*Iso (server), ensureWibOffset,
                                       TIMEZONE_OPTIONS (WIB/WITA/WIT)
components/
  ui/                              -- Card, SectionTitle, StatTile, EmptyState, dll
  layout/                          -- Sidebar, BottomNav, MoreSheet, nav-items (grouped)
  auth/GoogleButton.tsx            -- tombol "Lanjutkan dengan Google"
  chat/ChatWidget.tsx, MarkdownLite.tsx  -- chat + render markdown ringan
supabase/
  schema_phase1.sql … schema_phase11_*.sql, schema_all.sql (gabungan)
  fix_auto_profile.sql             -- WAJIB dijalankan, lihat "Perbaikan penting"
```

## Prinsip yang sudah diterapkan di Fase 1 (lihat prompt asli, Bagian 2)

- Setiap entitas (expense) sudah punya pasangan `log_`/`get_`/`delete_` sejak awal.
- `delete_expense` memakai pola cari-kandidat-dulu: 0 hasil → bilang tidak ketemu,
  >1 hasil → kembalikan daftar & minta konfirmasi, hanya hapus setelah `confirm_expense_id`
  eksplisit dikirim di panggilan berikutnya.
- System prompt melarang eksplisit memakai tool `log_`/`create_` sebagai respons atas
  permintaan hapus/ubah.
- Riwayat percakapan yang dikirim ke `/api/chat` sekarang hanya berisi **dialog user + jawaban akhir**
  dan dipangkas per giliran; tool-call internal tidak dikirim ulang ke browser. Untuk aksi hapus,
  ID kandidat yang sedang menunggu konfirmasi disimpan sebagai state kecil (`pendingAction`) agar
  pesan seperti "iya" tetap bisa mengeksekusi penghapusan tanpa membebani prompt dengan seluruh tool history.
- Semua tool call dicatat ke `ai_function_call_logs`.
- Token warna di `app/globals.css` (`--bg`, `--surface`, `--text`, `--accent`, dst),
  tidak ada warna hardcoded di komponen.


## Fase 7–12 — Connected Personal OS

Versi ini mengembangkan Licia menjadi **Connected Personal OS**. Modul tidak lagi berdiri
sendiri, tetapi saling mengisi konteks:

- **Capture:** Smart Inbox, Chat, Notes, Vault.
- **Understand:** Context Engine, Memory Licia, Universal Search, Decision Journal.
- **Plan:** Goals, Projects, Areas, Calendar, AI Weekly Planner.
- **Execute:** Tasks, Focus Space, Pomodoro, Learning & Skills, Routines.
- **Review:** Today Brief, End of Day, Weekly Review, Timeline, Personal Analytics.
- **Life support:** Finance, Subscriptions, Health, Reading, dan pencatatan gerak harian.
- **Proactive layer:** Automation Center, signal lintas modul, dan rekomendasi langkah berikutnya yang tetap meminta
  tindakan pengguna untuk perubahan data penting.
- **Modern app layer:** Command Palette, PWA/offline shell, layout responsif, dan pencatatan
  aktivitas lintas modul.

### Perbaikan penting v12

- `LiveClock` tidak lagi menghitung waktu pada render awal, sehingga tidak memicu React hydration
  mismatch ketika server dan browser melewati pergantian menit.
- Kalender membatasi tinggi daftar agenda, memotong deskripsi panjang, dan membuka detail lengkap
  lewat modal saat agenda diklik.
- Focus Space menerima durasi manual mulai **1 menit** dan menggunakan timestamp agar timer tidak
  mudah drift saat tab berada di background.
- Tasks diposisikan sebagai **antrean tindakan**, sedangkan Calendar menjadi **ruang waktu**; keduanya
  dapat tetap dihubungkan tanpa mengulang fungsi yang sama.
- Timeline memakai pagination visual 24 item dan grouping per hari, serta kini dapat menampilkan
  bukti aktivitas membaca dan metrik kesehatan.
- Health difokuskan pada catatan kebiasaan harian yang dapat diamati (hidrasi, gerak, makan, kafein, obat); tabel metrik fisik lama tetap dipertahankan sebagai arsip database.
- Finance memakai tab responsif agar tabel tidak dipaksa berdampingan di HP.
- Export memformat rencana mingguan AI menjadi kartu per hari dan blok waktu; JSON mentah hanya tersedia
  sebagai detail opsional.
- Pengaturan ukuran font telah dihapus; satu font tetap dipakai konsisten untuk judul dan isi.

### Skema database

Gunakan `supabase/schema_all.sql` untuk instalasi penuh. Fase lanjutan tersedia di:
`schema_phase7_connected.sql`, `schema_phase8_life_os.sql`, `schema_phase9_enrichment.sql`, dan
`schema_phase10_connections.sql`.

## Performance / production baseline

The current source keeps the same application features while reducing unnecessary work on mobile and low-memory VPS environments: global notifications use a lightweight summary path, daily intelligence avoids continuous polling, chat message rendering is memoized, optional fonts are not preloaded, and production builds use a memory-safe build runner.
