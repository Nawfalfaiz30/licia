# Licia 0.48.2 — Build Fix

Perbaikan compile pada halaman Tugas:
- `priorityPlan.focus` dibuat null-safe karena `priorityPlan` dapat bernilai `null`.
- Version metadata dan verifier diselaraskan ke 0.48.2.
- Regression test memastikan expression null-safe tetap ada.
