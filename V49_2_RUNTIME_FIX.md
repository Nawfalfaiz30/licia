# Runtime & Schedule Reliability

## Chat request lifecycle
- Chat API menggunakan mode dynamic dan execution window yang lebih panjang.
- OpenAI retry sekarang menghormati `AbortSignal` dan tidak mengulang request yang sudah dibatalkan browser.
- Vision, main chat, synthesis, dan recovery meneruskan signal request ke OpenAI.
- Request yang sudah ditutup tidak diteruskan ke recovery mutation.
- Tujuannya mengurangi pekerjaan server yang tetap berjalan ketika koneksi chat sudah terputus.

## Penghapusan agenda
- Keyword penghapusan agenda dinormalisasi dari bahasa natural.
- Kata pembungkus seperti `yang`, `tolong`, `jadwal`, dan `dihapus` tidak mengganggu pencocokan judul.
- Bila `ilike` langsung tidak menemukan hasil, digunakan fallback token matching pada maksimal 200 kandidat.
- Konfirmasi penghapusan tetap dipertahankan; matching yang lebih toleran tidak menghapus otomatis.

## Hasil perilaku yang diharapkan
`Yang Logika Informatika tolong dihapus` sekarang dapat menemukan agenda bernama `Logika Informatika` tanpa harus bergantung pada keyword yang persis sama.
