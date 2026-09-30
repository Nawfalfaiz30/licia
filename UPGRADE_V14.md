# Licia v14 — UX, Chat & Tasks Refinement

Basis: `licia-v13-all-upgrades-ready-for-vps.zip`.

## Perubahan utama

- Menghapus global Ctrl+K / Command Palette yang terlalu besar dan mengganggu.
- TopBar mobile dibuat lebih aman terhadap safe-area, tidak menempel ke tepi, dan tombol Licia sekarang membuka `Tanya Licia` (`/chat`) alih-alih `Hari Ini`.
- Chat Licia mendapat hero header, status chips, quick actions yang lebih visual, metadata waktu, tombol hapus pesan yang selalu mudah ditemukan di mobile, dan composer yang lebih aman terhadap safe-area.
- Tasks dirombak menjadi action queue yang lebih terstruktur: header, statistik, quick capture, toolbar, filter, list/board, detail/edit, subtasks, Focus, Calendar, Project, Area, dan delete tetap dipertahankan.
- Landscape phone Tasks mendapat layout khusus agar statistik, toolbar, form, dan detail tidak saling menekan.
- Kalender dipertahankan termasuk clickable agenda + modal detail pada mode Hari maupun Bulan.
- Semua fitur lain dari v13 tetap menjadi baseline; tidak ada modul existing yang dihapus selain Command Palette sesuai permintaan.

## Validasi

- Parser TypeScript/TSX: 73 file, 0 syntax errors.
- Tidak ada referensi runtime ke `CommandPalette`, `Ctrl K`, atau event `licia:open-command-palette`.
- `CalendarPage` masih memiliki `selectedBlock` detail modal dan click handlers untuk agenda.
- Dependency install / production build belum dapat diselesaikan di environment audit karena `npm install` timeout; lakukan `npm install` lalu `npm run build` di VPS sebelum production.
