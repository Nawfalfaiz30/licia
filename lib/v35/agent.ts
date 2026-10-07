export const LICIA_AGENT_POLICY = `
ATURAN AGEN LICIA:
1. Pahami tujuan pengguna sebelum memilih tool. Untuk permintaan lintas modul, baca konteks lintas Life OS terlebih dahulu.
2. Gunakan pola READ → VALIDATE → PLAN → ACT → VERIFY → SUMMARIZE. Jangan menyatakan perubahan berhasil tanpa hasil tool yang sukses.
3. Jika target ambigu, minta klarifikasi atau gunakan tool pencarian/kandidat. Jangan menebak ID atau entity.
4. Aksi massal/destruktif: buat preview, jelaskan jumlah target dan dampak, lalu tunggu konfirmasi bila pengaturan konfirmasi aktif.
5. Untuk simulasi gunakan simulate_planner. Simulasi tidak boleh mengubah data asli.
6. Untuk keadaan proaktif gunakan get_daily_brain dan AI Watcher; jangan membuat reminder baru jika watcher atau automation yang sudah ada lebih tepat.
7. Jika tool gagal, bedakan retryable dan non-retryable. Retry identik maksimal sekali; setelah itu ubah strategi atau jelaskan error sebenarnya.
8. Jika satu langkah berhasil dan langkah lain gagal, jangan mengulang langkah yang sudah berhasil. Lanjutkan dari state terverifikasi.
9. Saat membaca semua data, bedakan data tersedia, data kosong, dan data tidak tersedia. Error query bukan berarti pengguna tidak mempunyai data.
10. Untuk tanggal/waktu selalu gunakan timezone pengguna dan tanggal absolut ketika ada potensi ambigu.
11. Setelah CRUD, jika memungkinkan verifikasi state target dengan pembacaan ulang. Gunakan hasil verifikasi dalam ringkasan.
12. Alasan tindakan cukup operasional: sebutkan tujuan, data yang dipakai, dan perubahan yang dilakukan. Jangan mengungkap chain-of-thought internal.
13. Jangan mengarang hubungan antar-entitas, angka keuangan, tren kesehatan, atau status reminder/push.
14. Jika pengguna meminta "lakukan semuanya", pecah pekerjaan menjadi batch yang dapat dilacak dan jangan membuat lebih dari satu perubahan identik.
`;

const HIGH_RISK_TOOLS = new Set([
  "delete_expense",
  "delete_task",
  "delete_tasks_bulk",
  "delete_schedule_block",
  "delete_schedule_blocks_bulk",
  "delete_project",
  "delete_goal",
  "delete_note",
  "delete_memory",
  "delete_vault_item",
  "delete_automation",
  "delete_habit",
  "delete_subscription",
  "delete_notification",
  "delete_all_notifications",
  "delete_income",
  "delete_budget",
  "delete_account",
  "delete_reminder",
  "delete_all_reminders",
  "delete_decision",
  "delete_skill",
  "delete_reading",
  "delete_pomodoro_session",
]);

export function agentRiskForTool(tool: string) {
  if (HIGH_RISK_TOOLS.has(tool)) return "destructive" as const;
  if (
    tool.startsWith("create_") ||
    tool.startsWith("update_") ||
    tool.startsWith("log_") ||
    tool.startsWith("checkin_") ||
    tool.startsWith("uncheckin_") ||
    tool === "manage_life_os_data" ||
    tool === "delete_task_dependency" ||
    tool === "create_task_dependency"
  )
    return "normal" as const;
  return "low" as const;
}

export function agentConfidenceFromResult(result: unknown) {
  if (!result || typeof result !== "object") return 0.5;
  const value = result as Record<string, unknown>;
  if (value.ok === false) return 0.2;
  if (value.verified === true) return 0.98;
  if (
    value.record ||
    value.task ||
    value.note ||
    value.reminder ||
    value.schedule ||
    value.project ||
    value.goal ||
    value.watcher
  )
    return 0.95;
  return value.ok === true ? 0.88 : 0.6;
}

export function isMutationToolName(tool: string) {
  return (
    /^(create_|update_|delete_|log_|capture_|save_|checkin_|uncheckin_|mark_|manage_)/.test(tool) ||
    tool === "create_task_dependency" ||
    tool === "delete_task_dependency"
  );
}
