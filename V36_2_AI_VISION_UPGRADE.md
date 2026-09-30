# Licia V36.2 — Vision & Calendar AI Upgrade

## Masalah yang diperbaiki
Sebelumnya, Vision menganggap jadwal harus berasal dari tabel mingguan yang mempunyai `weekday`. Akibatnya screenshot email konfirmasi yang berisi tanggal absolut dan rentang waktu — misalnya `tanggal 2 bulan Oktober tahun 2026` dan `14:20 - 15:20` — dapat dibaca sebagai teks biasa lalu ditolak sebagai jadwal yang belum terstruktur.

## Perubahan
- Vision schedule parser sekarang memahami email konfirmasi, invitation, calendar screenshot, dan timetable.
- Tanggal absolut dari gambar diekstrak ke `YYYY-MM-DD`.
- Parser memahami format seperti `tanggal 2 bulan Oktober tahun 2026`, `2 Oktober 2026`, ISO, dan beberapa format kalender umum.
- Jika `block_date` tersedia, weekday dihitung deterministic dari tanggal; AI tidak perlu menebak hari.
- Rentang waktu seperti `14:20 - 15:20` dipetakan menjadi `start_time` dan `end_time`.
- Detail penting email seperti recruitment stage/candidate note dapat disimpan pada `description`.
- Hasil ekstraksi terstruktur dimasukkan ke context AI agar AI dan calendar tool melihat fakta yang sama.
- Untuk permintaan eksplisit seperti `Tambahkan ke agenda saya`, tersedia deterministic fast-path yang langsung memakai hasil vision terstruktur sebagai input `create_daily_schedule`.
- Fast-path membuat undo history seperti aksi AI lainnya.
- Exact duplicate agenda yang sudah ada tidak dibuat ulang.
- Jika tanggal/jam belum konkret, Licia tetap meminta informasi yang kurang dan tidak menebak.

## Contoh kasus screenshot email interview
Input pengguna:
`Tambahkan ke agenda saya` + screenshot email yang berisi:
- Interview date: tanggal 2 bulan Oktober tahun 2026
- Interview time: 14:20 - 15:20

Hasil yang diharapkan:
- tanggal: `2026-10-02`
- weekday: `jumat`
- waktu: `14:20–15:20`
- event: judul interview dari email
- detail email yang relevan masuk ke deskripsi
- agenda dibuat satu kali dan bisa di-undo

## Verifikasi
- V36 baseline tests: PASS
- V36.1 regression tests: PASS
- V36.2 vision checks: PASS
- TypeScript parser check untuk `app/api/chat/route.ts`: PASS
- TypeScript parser check untuk `lib/ai/visionSchedule.ts`: PASS
