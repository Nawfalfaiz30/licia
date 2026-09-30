# Licia V35.3 — Schedule Image Import Fix

## Perbaikan

- Fallback `manage_life_os_data` tidak lagi diekspos untuk mutation kalender/jadwal ketika tool domain `create_daily_schedule` tersedia.
- `create_daily_schedule` diperjelas untuk mengimpor seluruh blok jadwal gambar dalam satu pemanggilan tool.
- Untuk instruksi seperti `mulai dari Senin besok sampai Sabtu`, server menambahkan rentang tanggal konkret berdasarkan timezone pengguna.
- Jadwal dari gambar hanya dipetakan ke hari yang benar-benar terlihat pada gambar; tidak membuat agenda pada hari kosong.
- `manage_life_os_data` sekarang menolak entity kalender dengan error yang menjelaskan tool yang benar.

## Contoh

Bila hari ini Minggu, 27 September 2026 di Asia/Jakarta dan pengguna berkata:

> Mulai dari Senin besok sampai Sabtu

rentangnya menjadi:

- Senin: 28 September 2026
- Sabtu: 3 Oktober 2026

Kelas pada gambar dipetakan hanya ke hari yang terlihat, lalu dikirim melalui satu `create_daily_schedule` berisi seluruh blok.
