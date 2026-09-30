export type AiDomain =
  | "overview" | "tasks" | "calendar" | "focus" | "finance" | "health"
  | "goals" | "notes" | "inbox" | "decisions" | "learning" | "reading"
  | "habits" | "subscriptions" | "memory" | "vault" | "automations" | "reminders" | "notifications" | "projects" | "all";

const domainKeywords: Record<AiDomain, string[]> = {
  all: ["semua data", "seluruh data", "semua yang saya punya", "semua modul", "life os", "gambaran besar", "hubungkan semua"],
  overview: ["hari ini", "today", "ringkasan", "apa yang harus", "konteks", "jadwalku", "beranda", "brief", "timeline", "analytics", "kondisi saya", "konflik", "kapasitas", "risiko proyek", "ruang fokus"],
  tasks: ["tugas", "task", "deadline", "tenggat", "todo", "kerjaan", "pekerjaan", "subtugas"],
  calendar: ["kalender", "agenda", "jadwal", "schedule", "acara", "meeting", "rapat", "jam ", "pukul ", "besok"],
  focus: ["fokus", "pomodoro", "focus", "konsentrasi", "sesi fokus"],
  finance: ["uang", "keuangan", "pengeluaran", "pemasukan", "saldo", "dompet", "anggaran", "budget", "biaya", "akun"],
  health: ["kesehatan", "minum", "air", "hidrasi", "kopi", "kafein", "makan", "obat", "gerak", "jalan", "olahraga", "tidur"],
  goals: ["target", "tujuan", "goal", "milestone", "langkah berikutnya"],
  notes: ["catatan", "note", "tulis catatan", "brain dump"],
  inbox: ["inbox", "tangkap", "capture", "pilah", "triage", "ide mentah"],
  decisions: ["keputusan", "decision", "decision journal", "review keputusan"],
  learning: ["belajar", "skill", "keterampilan", "latihan", "learning"],
  reading: ["baca", "bacaan", "buku", "membaca", "reading"],
  habits: ["kebiasaan", "rutinitas", "habit", "check-in habit"],
  subscriptions: ["langganan", "subscription", "tagihan rutin", "renewal"],
  memory: ["ingat", "ingatan", "memory", "lupakan", "hapus ingatan", "yang kamu ingat"],
  vault: ["vault", "dokumen pribadi", "snippet", "knowledge", "pengetahuan tersimpan", "catatan tersimpan"],
  automations: ["automation", "otomatisasi", "aturan licia", "pengingat otomatis", "proaktif"],
  reminders: ["pengingat", "ingatkan", "reminder", "diingatkan", "sebelum agenda"],
  notifications: ["notifikasi", "notification", "riwayat notifikasi", "pusat notifikasi", "hapus notifikasi", "notifikasi push"],
  projects: ["project", "proyek", "pekerjaan besar", "milestone project"],
};

const readTools: Partial<Record<AiDomain, string[]>> = {
  overview: ["get_today_overview", "get_life_snapshot", "get_daily_brain", "search_life_os", "resolve_calendar_date"], tasks: ["get_tasks", "get_task_dependencies"], calendar: ["get_schedule", "resolve_calendar_date"], focus: ["get_pomodoro_sessions", "get_tasks"],
  finance: ["get_expense_summary", "get_incomes", "get_budgets", "get_accounts", "get_net_worth", "get_subscriptions"], health: ["get_health_summary", "get_life_module_data"], goals: ["get_goals"], notes: ["get_notes", "get_life_module_data"],
  inbox: ["get_today_overview", "get_life_module_data"], decisions: ["get_decisions"], learning: ["get_skills"], reading: ["get_reading_list", "get_life_module_data"], habits: ["get_habits", "get_life_module_data"], subscriptions: ["get_subscriptions"], memory: ["get_memories"], vault: ["get_vault_items"], automations: ["get_automation_rules", "get_ai_watchers"], reminders: ["get_reminders"], projects: ["get_projects", "get_life_module_data"],
  notifications: ["get_notifications"],
  all: ["get_unified_life_snapshot", "get_life_module_data", "get_daily_brain", "get_ai_watchers", "search_life_os", "get_notifications"],
};

const writeTools: Partial<Record<AiDomain, string[]>> = {
  overview: [], tasks: ["create_task_with_subtasks", "create_task_dependency", "delete_task_dependency", "update_task", "delete_task", "delete_tasks_bulk", "delete_subtask", "create_task_from_schedule", "create_task_from_inbox", "create_task_from_note", "create_task_from_project", "create_task_from_goal", "create_schedule_from_task", "create_schedule_reminder"], calendar: ["create_daily_schedule", "update_schedule_block", "delete_schedule_block", "delete_schedule_blocks_bulk", "create_schedule_from_task", "create_task_from_schedule", "create_schedule_reminder"], focus: ["log_pomodoro_session", "delete_pomodoro_session", "update_task"],
  finance: ["log_expense", "delete_expense", "log_expenses_batch", "update_expense", "log_income", "update_income", "delete_income", "create_budget", "update_budget", "delete_budget", "create_account", "update_account", "delete_account", "transfer_money", "get_account_transactions", "get_net_worth", "create_subscription", "update_subscription", "delete_subscription"], health: ["log_health", "delete_health_log"],
  goals: ["create_goal", "update_goal", "delete_goal", "create_task_from_goal"], notes: ["create_note", "update_note", "delete_note", "create_task_from_note"], inbox: ["capture_inbox_item", "create_task_from_inbox"], decisions: ["log_decision", "update_decision", "delete_decision"], learning: ["create_skill", "update_skill", "delete_skill"], reading: ["log_reading", "update_reading", "delete_reading"], habits: ["create_habit", "update_habit", "checkin_habit", "uncheckin_habit", "delete_habit"], subscriptions: ["create_subscription", "update_subscription", "delete_subscription"], memory: ["save_memory", "delete_memory"], vault: ["create_vault_item", "update_vault_item", "delete_vault_item"], automations: ["create_automation", "update_automation", "delete_automation", "create_ai_watcher", "update_ai_watcher", "delete_ai_watcher", "create_schedule_reminder", "create_reminder", "update_reminder", "delete_reminder"], reminders: ["create_reminder", "update_reminder", "delete_reminder", "create_schedule_reminder"], projects: ["create_project", "update_project", "delete_project", "create_task_from_project"],
};

const deletePattern = /\b(hapus|delete|buang|hilangkan|hapuskan)\b/i;
const updatePattern = /\b(ubah|edit|update|ganti|pindah|arsipkan|aktifkan|nonaktifkan|matikan|nyalakan|hubungkan)\b/i;
const createPattern = /\b(buat|buatkan|catat|simpan|tambah|tambahkan|masukkan|input|import|jadwalkan|ubah jadi|jadikan|convert|konversi|log|check[-\s]?in|centang|tandai)\b/i;
const actionPattern = new RegExp(`${deletePattern.source}|${updatePattern.source}|${createPattern.source}`, "i");

function selectWriteNames(names: string[], text: string) {
  if (deletePattern.test(text)) {
    const q = text.toLowerCase();
    if (/\b(notifikasi|notification)\b/i.test(q) && names.includes("delete_all_notifications") && /\b(semua|seluruh|semuanya|riwayat)\b/i.test(q)) return ["delete_all_notifications"];
    if (/\b(pengingat|reminder)\b/i.test(q) && names.includes("delete_all_reminders") && /\b(hapus|hapuskan|hilangkan|batalkan)\b/i.test(q) && /\b(semua|seluruh|semuanya)\b/i.test(q)) return ["delete_all_reminders"];
    const massTaskDelete = /\b(hapus|delete|buang|hilangkan|hapuskan)\b[\s\S]{0,80}\b(semua|seluruh|semuanya|massal|bulk|all)\b[\s\S]{0,80}\b(tugas|task)\b|\b(semua|seluruh|semuanya|massal|bulk|all)\b[\s\S]{0,40}\b(tugas|task)\b/i.test(q);
    const massScheduleDelete = /\b(hapus|delete|buang|hilangkan|hapuskan)\b[\s\S]{0,100}\b(semua|seluruh|semuanya|massal|bulk|all)\b[\s\S]{0,100}\b(agenda|jadwal|kalender|schedule)\b|\b(semua|seluruh|semuanya|massal|bulk|all)\b[\s\S]{0,60}\b(agenda|jadwal|kalender|schedule)\b/i.test(q);
    if (massScheduleDelete && names.includes("delete_schedule_blocks_bulk")) return ["delete_schedule_blocks_bulk"];
    if (massTaskDelete && names.includes("delete_tasks_bulk")) return ["delete_tasks_bulk"];
    return names.filter((n) => n.startsWith("delete_"));
  }
  if (updatePattern.test(text) || /\bcheck[-\s]?in\b/i.test(text)) return names.filter((n) => /^(update_|uncheckin_|checkin_|create_task_from_schedule)/.test(n));
  if (createPattern.test(text)) return names.filter((n) => /^(create_|log_|capture_|checkin_)/.test(n));
  return names;
}

export function detectAiDomains(text: string): AiDomain[] {
  const q = text.toLowerCase().trim();
  const hits = (Object.keys(domainKeywords) as AiDomain[]).filter((domain) => domainKeywords[domain].some((key) => q.includes(key)));
  const cross = /\b(hubungkan|terkait|gabungkan|sinkron|dari .*(jadi|ke)|jadikan .* tugas|jadikan .* pengingat|semuanya|semua data|lintas modul)\b/i.test(q);
  const out = new Set<AiDomain>(hits.filter((x) => x !== "all"));
  if (!hits.length) out.add("overview");
  if (hits.includes("all") || cross || /\bsemua\b/i.test(q) && /(data|modul|hidup|aktivitas)/i.test(q)) { out.add("all"); out.add("overview"); }
  return [...out];
}


export function getDomainToolNames(domains: AiDomain[]) {
  const names = new Set<string>();
  for (const domain of domains) {
    for (const name of readTools[domain] ?? []) names.add(name);
    for (const name of writeTools[domain] ?? []) names.add(name);
  }
  return names;
}

export function selectMutationToolDefs<T extends { function?: { name?: string } }>(defs: T[], domains: AiDomain[]) {
  const names = new Set<string>();
  for (const domain of domains) for (const name of writeTools[domain] ?? []) names.add(name);
  if (domains.includes("overview")) {
    for (const domain of ["tasks", "calendar", "finance", "goals", "projects", "notes"] as AiDomain[]) {
      for (const name of writeTools[domain] ?? []) names.add(name);
    }
  }
  return defs.filter((d) => d.function?.name && names.has(d.function.name));
}

export function selectReadToolDefs<T extends { function?: { name?: string } }>(defs: T[]) {
  const names = new Set<string>();
  for (const readNames of Object.values(readTools)) {
    for (const name of readNames ?? []) names.add(name);
  }
  ["get_unified_life_snapshot", "get_daily_brain", "get_ai_watchers", "get_life_module_data", "search_life_os", "resolve_calendar_date"].forEach((name) => names.add(name));
  return defs.filter((d) => d.function?.name && names.has(d.function.name));
}

export function selectToolDefs<T extends { function?: { name?: string } }>(defs: T[], domains: AiDomain[], userText = "") {
  const names = new Set<string>();
  const wantsWrite = actionPattern.test(userText);
  const scheduleIntent = /\b(jadwal|kalender|kelas|kuliah|agenda|mata kuliah|meeting|rapat)\b/i.test(userText);
  // Fallback CRUD jangan diekspos untuk mutation kalender/jadwal ketika tool domain
  // khusus tersedia. Tanpa guard ini model dapat memilih manage_life_os_data dan
  // mengirim field seperti block_date/start_time/title ke entity yang salah, lalu
  // menghasilkan "Tidak ada field valid untuk dibuat".
  const fallbackAllowed = !(wantsWrite && scheduleIntent && domains.includes("calendar"));
  if (fallbackAllowed) names.add("manage_life_os_data");
  const cross = domains.includes("all") || /\b(hubungkan|jadikan .* tugas|dari .* kalender|dari .* agenda|pengingat|ingatkan|lintas modul|semua data)\b/i.test(userText);
  for (const domain of domains) {
    if (domain === "all") {
      for (const [readDomain, readNames] of Object.entries(readTools)) {
        if (readDomain !== "all") for (const name of readNames ?? []) names.add(name);
      }
      names.add("get_unified_life_snapshot");
      names.add("get_daily_brain");
      names.add("get_ai_watchers");
      names.add("get_life_module_data");
      names.add("search_life_os");
      if (wantsWrite) {
        // Saat pengguna benar-benar meminta aksi lintas Life OS, expose seluruh
        // write surface yang tersedia. Penghapusan tetap dilindungi oleh
        // confirmation/pending-action di chat route.
        for (const writeDomain of Object.values(writeTools)) {
          for (const name of writeDomain ?? []) names.add(name);
        }
      }
    } else {
      for (const name of readTools[domain] ?? []) names.add(name);
    }
    if (wantsWrite) for (const name of selectWriteNames(writeTools[domain] ?? [], userText)) names.add(name);
  }
  if (/\b(rencana|planner|simulasi|bagaimana kalau|what-if|geser|atur ulang)\b/i.test(userText)) {
    ["get_daily_brain", "simulate_planner", "get_schedule", "get_tasks"].forEach((n) => names.add(n));
  }
  if (cross) {
    ["get_unified_life_snapshot", "get_daily_brain", "get_ai_watchers", "get_life_module_data", "search_life_os", "get_tasks", "get_schedule", "get_reminders", "create_task_with_subtasks", "create_task_from_schedule", "create_task_from_inbox", "create_task_from_note", "create_task_from_project", "create_task_from_goal", "create_schedule_from_task", "create_schedule_reminder", "create_reminder", "update_reminder", "delete_reminder", "update_schedule_block", "delete_schedule_blocks_bulk", "create_automation", "delete_tasks_bulk"].forEach((n) => names.add(n));
    // Do not add every write schema for an "all" query. Explicit domain hits above already add the relevant tools.
  }
  if (!names.size) ["get_today_overview", "get_life_snapshot"].forEach((n) => names.add(n));
  return defs.filter((d) => d.function?.name && names.has(d.function.name));
}
