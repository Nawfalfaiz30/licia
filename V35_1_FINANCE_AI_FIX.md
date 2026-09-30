# Licia V35.1 — AI Pending + Dompet & Keuangan

## Perbaikan AI pending actions
- Status inti `ai_pending_actions` sekarang disimpan memakai kolom baseline saja.
- Metadata `completed_actions`, `failed_actions`, `error_summary`, dan `execution_result` ditulis terpisah sebagai metadata opsional.
- Schema cache PostgREST yang belum diperbarui tidak lagi membuat batch yang sudah berhasil dieksekusi dilaporkan gagal.

## Perbaikan dompet
- `log_expense` dan `log_income` menerima `account_id` / `account_name`.
- Jika pengguna berkata `Beli bakso 10k pakai Bank Mandiri`, AI menyelesaikan nama dompet ke account dan menyimpan `account_id`.
- Saldo berjalan mengikutsertakan pemasukan, pengeluaran, dan transfer antar-dompet.
- Ditambahkan `transfer_money` dan `get_account_transactions`.
- Dompet mempunyai jenis (`bank`, `cash`, `ewallet`, `other`) dan opsi dompet utama.
- UI Keuangan menyediakan transfer antar-dompet dan memperjelas transaksi tanpa dompet.

## Inferensi dompet dari bahasa natural
Chat sekarang juga mencocokkan nama dompet yang benar-benar ada di akun pengguna terhadap teks permintaan. Jadi kalimat seperti `Beli bakso 10k pakai Bank Mandiri` tetap akan memasukkan `account_id` yang benar walaupun model lupa mengisi `account_name` pada tool call pertama.
