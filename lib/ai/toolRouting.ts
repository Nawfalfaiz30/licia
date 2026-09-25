export type AiDomain =
  | "overview" | "tasks" | "calendar" | "focus" | "finance" | "health"
  | "goals" | "notes" | "inbox" | "decisions" | "learning" | "reading"
  | "habits" | "subscriptions" | "memory" | "vault" | "automations" | "reminders" | "projects" | "all";

const domainKeywords: Record<AiDomain, string[]> = {
  all: ["semua data", "seluruh data", "semua yang saya punya", "semua modul", "life os", "gambaran besar", "hubungkan semua"],
  overview: ["hari ini", "today", "ringkasan", "apa yang harus", "konteks", "jadwalku", "beranda", "brief", "timeline", "analytics", "kondisi saya"],
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
  projects: ["project", "proyek", "pekerjaan besar", "milestone project"],
};

const readTools: Partial<Record<AiDomain, string[]>> = {
  overview: ["get_today_overview", "get_life_snapshot", "search_life_os"], tasks: ["get_tasks"], calendar: ["get_schedule"], focus: ["get_pomodoro_sessions", "get_tasks"],
  finance: ["get_expense_summary", "get_incomes", "get_budgets", "get_accounts", "get_net_worth", "get_subscriptions"], health: ["get_health_summary", "get_life_module_data"], goals: ["get_goals"], notes: ["get_notes", "get_life_module_data"],
  inbox: ["get_today_overview", "get_life_module_data"], decisions: ["get_decisions"], learning: ["get_skills"], reading: ["get_reading_list", "get_life_module_data"], habits: ["get_habits", "get_life_module_data"], subscriptions: ["get_subscriptions"], memory: ["get_memories"], vault: ["get_vault_items"], automations: ["get_automation_rules"], reminders: ["get_reminders"], projects: ["get_projects", "get_life_module_data"],
  all: ["get_unified_life_snapshot", "get_life_module_data", "search_life_os"],
};

const writeTools: Partial<Record<AiDomain, string[]>> = {
  overview: [], tasks: ["create_task_with_subtasks", "update_task", "delete_task", "delete_tasks_bulk", "delete_subtask", "create_task_from_schedule", "create_task_from_inbox", "create_task_from_note", "create_task_from_project", "create_task_from_goal", "create_schedule_from_task", "create_schedule_reminder"], calendar: ["create_daily_schedule", "update_schedule_block", "delete_schedule_block", "create_schedule_from_task", "create_task_from_schedule", "create_schedule_reminder"], focus: ["log_pomodoro_session", "delete_pomodoro_session", "update_task"],
  finance: ["log_expense", "delete_expense", "log_expenses_batch", "update_expense", "log_income", "update_income", "delete_income", "create_budget", "update_budget", "delete_budget", "create_account", "update_account", "delete_account", "create_subscription", "update_subscription", "delete_subscription"], health: ["log_health", "delete_health_log"],
  goals: ["create_goal", "update_goal", "delete_goal", "create_task_from_goal"], notes: ["create_note", "update_note", "delete_note", "create_task_from_note"], inbox: ["capture_inbox_item", "create_task_from_inbox"], decisions: ["log_decision", "update_decision", "delete_decision"], learning: ["create_skill", "update_skill", "delete_skill"], reading: ["log_reading", "update_reading", "delete_reading"], habits: ["create_habit", "update_habit", "checkin_habit", "uncheckin_habit", "delete_habit"], subscriptions: ["create_subscription", "update_subscription", "delete_subscription"], memory: ["save_memory", "delete_memory"], vault: ["create_vault_item", "update_vault_item", "delete_vault_item"], automations: ["create_automation", "update_automation", "delete_automation", "create_schedule_reminder", "create_reminder", "update_reminder", "delete_reminder"], reminders: ["create_reminder", "update_reminder", "delete_reminder", "create_schedule_reminder"], projects: ["create_project", "update_project", "delete_project", "create_task_from_project"],
};

const deletePattern = /\b(hapus|delete|buang|hilangkan|hapuskan)\b/i;
const updatePattern = /\b(ubah|edit|update|ganti|pindah|arsipkan|aktifkan|nonaktifkan|matikan|nyalakan|hubungkan)\b/i;
const createPattern = /\b(buat|buatkan|catat|simpan|tambah|tambahkan|jadwalkan|ubah jadi|jadikan|convert|konversi|log|checkin|centang)\b/i;
const actionPattern = new RegExp(`${deletePattern.source}|${updatePattern.source}|${createPattern.source}`, "i");

function selectWriteNames(names: string[], text: string) {
  if (deletePattern.test(text)) {
    const q = text.toLowerCase();
    const massTaskDelete = /\b(hapus|delete|buang|hilangkan|hapuskan)\b[\s\S]{0,80}\b(semua|seluruh|semuanya|massal|bulk|all)\b[\s\S]{0,80}\b(tugas|task)\b|\b(semua|seluruh|semuanya|massal|bulk|all)\b[\s\S]{0,40}\b(tugas|task)\b/i.test(q);
    if (massTaskDelete && names.includes("delete_tasks_bulk")) return ["delete_tasks_bulk"];
    return names.filter((n) => n.startsWith("delete_"));
  }
  if (updatePattern.test(text)) return names.filter((n) => /^(update_|uncheckin_|checkin_|create_task_from_schedule)/.test(n));
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

export function selectToolDefs<T extends { function?: { name?: string } }>(defs: T[], domains: AiDomain[], userText = "") {
  const names = new Set<string>();
  const wantsWrite = actionPattern.test(userText);
  const cross = domains.includes("all") || /\b(hubungkan|jadikan .* tugas|dari .* kalender|dari .* agenda|pengingat|ingatkan|lintas modul|semua data)\b/i.test(userText);
  for (const domain of domains) {
    if (domain === "all") {
      for (const [readDomain, readNames] of Object.entries(readTools)) {
        if (readDomain !== "all") for (const name of readNames ?? []) names.add(name);
      }
      names.add("get_unified_life_snapshot");
      names.add("get_life_module_data");
      names.add("search_life_os");
      if (wantsWrite) {
        for (const name of ["create_task_with_subtasks","update_task","create_task_from_schedule","create_task_from_inbox","create_task_from_note","create_task_from_project","create_task_from_goal","create_schedule_from_task","create_schedule_reminder","create_note","create_project","create_goal","create_automation"]) names.add(name);
      }
    } else {
      for (const name of readTools[domain] ?? []) names.add(name);
    }
    if (wantsWrite) for (const name of selectWriteNames(writeTools[domain] ?? [], userText)) names.add(name);
  }
  if (cross) {
    ["get_unified_life_snapshot", "get_life_module_data", "search_life_os", "get_tasks", "get_schedule", "get_reminders", "create_task_with_subtasks", "create_task_from_schedule", "create_task_from_inbox", "create_task_from_note", "create_task_from_project", "create_task_from_goal", "create_schedule_from_task", "create_schedule_reminder", "create_reminder", "update_reminder", "delete_reminder", "update_schedule_block", "create_automation", "delete_tasks_bulk"].forEach((n) => names.add(n));
    // Do not add every write schema for an "all" query. Explicit domain hits above already add the relevant tools.
  }
  if (!names.size) ["get_today_overview", "get_life_snapshot"].forEach((n) => names.add(n));
  return defs.filter((d) => d.function?.name && names.has(d.function.name));
}
