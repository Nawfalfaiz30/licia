# Licia — AI Intelligence Upgrade

Upgrade ini berfokus pada pemahaman konteks, pergantian topik, reliabilitas CRUD, dan kejujuran status aksi.

## Topic boundary
Pesan terbaru menjadi sumber utama penentuan domain. Riwayat lama hanya dipakai saat pesan benar-benar merupakan follow-up atau memakai referensi seperti “yang tadi”.

## Mutation contract
Permintaan membuat, mencatat, mengubah, atau menjadwalkan diperlakukan sebagai mutation intent. Untuk operasi non-destruktif, model diwajibkan menghasilkan tool call; hasil sukses kemudian diverifikasi di database.

## Database verification
Verifier sekarang mendukung pengecekan isi field penting, batch insert, dan readback berdasarkan ID nyata. `ok: true` tanpa verifikasi tidak otomatis dianggap sukses.

## Recovery
Jika model tidak menjalankan mutation walaupun intent jelas, runtime mencoba satu jalur recovery dengan tool mutation-only yang relevan. Operasi destruktif tidak dipaksa melalui jalur recovery.

## Conversation state
State singkat memuat domain aktif, operasi terakhir, ID entitas yang baru dibuat, label referensi, dan tool terakhir. State memiliki TTL agar konteks lama tidak terus melekat.

## Compact action receipt
Ringkasan aksi tidak lagi dibuat sebagai panel besar yang permanen di bawah percakapan. Hasil sukses melekat pada bubble jawaban sebagai receipt ringkas yang bisa dibuka untuk melihat detail dan undo.
