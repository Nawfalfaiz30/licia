export type CapabilityOperation = "create" | "read" | "update" | "delete";

export type LifeOsCapability = {
  key: string;
  label: string;
  route?: string;
  operations: CapabilityOperation[];
  preferredTools?: string[];
  entities?: string[];
};

const CAPABILITIES: LifeOsCapability[] = [
  { key: "overview", label: "Beranda / Overview", route: "/dashboard", operations: ["read"], preferredTools: ["get_today_overview", "get_life_snapshot", "get_unified_life_snapshot"] },
  { key: "today", label: "Hari Ini", route: "/today", operations: ["read"], preferredTools: ["get_today_overview", "get_life_snapshot"] },
  { key: "tasks", label: "Tugas", route: "/tasks", operations: ["create", "read", "update", "delete"], preferredTools: ["create_task_with_subtasks", "get_tasks", "update_task", "update_tasks_bulk", "delete_task", "delete_tasks_bulk"], entities: ["tasks", "subtasks", "task_dependencies"] },
  { key: "calendar", label: "Kalender / Agenda", route: "/calendar", operations: ["create", "read", "update", "delete"], preferredTools: ["create_daily_schedule", "get_schedule", "update_schedule_block", "delete_schedule_block", "delete_schedule_blocks_bulk"], entities: ["schedule_blocks"] },
  { key: "focus", label: "Fokus / Pomodoro", route: "/focus", operations: ["create", "read", "delete"], preferredTools: ["log_pomodoro_session", "get_pomodoro_sessions", "delete_pomodoro_session"], entities: ["pomodoro_sessions"] },
  { key: "finance", label: "Keuangan", route: "/finance", operations: ["create", "read", "update", "delete"], preferredTools: ["log_expense", "log_income", "get_expense_summary", "get_incomes", "update_expense", "update_income", "get_accounts", "create_account", "update_account", "delete_account", "transfer_money", "get_budgets", "create_budget", "update_budget", "delete_budget", "get_subscriptions", "create_subscription", "update_subscription", "delete_subscription"], entities: ["expenses", "incomes", "accounts", "account_transfers", "budgets", "subscriptions"] },
  { key: "goals", label: "Target & Proyek", route: "/goals-projects", operations: ["create", "read", "update", "delete"], preferredTools: ["get_goals", "create_goal", "update_goal", "delete_goal"], entities: ["goals", "goal_milestones", "projects"] },
  { key: "projects", label: "Proyek", route: "/goals-projects", operations: ["create", "read", "update", "delete"], preferredTools: ["get_projects", "create_project", "update_project", "delete_project"], entities: ["projects", "project_tasks"] },
  { key: "knowledge", label: "Knowledge & Belajar", route: "/knowledge", operations: ["create", "read", "update", "delete"], preferredTools: ["get_notes", "create_note", "update_note", "delete_note", "get_skills", "create_skill", "update_skill", "delete_skill", "get_reading_list", "log_reading", "update_reading", "delete_reading"], entities: ["brain_dump_notes", "skills", "reading_logs", "reading_sessions", "vault_items"] },
  { key: "capture", label: "Tangkap / Smart Inbox", route: "/capture", operations: ["create", "read", "update", "delete"], preferredTools: ["capture_inbox_item", "create_task_from_inbox", "get_life_module_data", "manage_life_os_data"], entities: ["smart_inbox_items"] },
  { key: "health", label: "Kesehatan & Rutinitas", route: "/wellbeing", operations: ["create", "read", "update", "delete"], preferredTools: ["log_health", "get_health_summary", "delete_health_log", "manage_life_os_data"], entities: ["sleep_logs", "hydration_logs", "caffeine_logs", "meal_logs", "medication_logs", "fatigue_logs", "movement_logs", "health_metrics", "habits"] },
  { key: "habits", label: "Rutinitas", route: "/wellbeing", operations: ["create", "read", "update", "delete"], preferredTools: ["get_habits", "create_habit", "update_habit", "checkin_habit", "uncheckin_habit", "delete_habit"], entities: ["habits", "habit_checkins"] },
  { key: "memory", label: "Memory", route: "/memory", operations: ["create", "read", "update", "delete"], preferredTools: ["get_memories", "save_memory", "manage_life_os_data", "delete_memory"], entities: ["user_memories"] },
  { key: "vault", label: "Vault", route: "/vault", operations: ["create", "read", "update", "delete"], preferredTools: ["get_vault_items", "create_vault_item", "update_vault_item", "delete_vault_item"], entities: ["vault_items"] },
  { key: "decisions", label: "Decision Journal", route: "/decisions", operations: ["create", "read", "update", "delete"], preferredTools: ["get_decisions", "log_decision", "update_decision", "delete_decision"], entities: ["decisions"] },
  { key: "reminders", label: "Pengingat", route: "/reminders", operations: ["create", "read", "update", "delete"], preferredTools: ["get_reminders", "create_reminder", "update_reminder", "delete_reminder", "create_schedule_reminder", "delete_all_reminders"], entities: ["reminders"] },
  { key: "notifications", label: "Notifikasi", route: "/dashboard", operations: ["read", "update", "delete"], preferredTools: ["get_notifications", "mark_notification_read", "delete_notification", "delete_all_notifications"], entities: ["notification_events"] },
  { key: "automations", label: "Otomasi & Watchers", route: "/insights", operations: ["create", "read", "update", "delete"], preferredTools: ["get_automation_rules", "create_automation", "update_automation", "delete_automation", "get_ai_watchers", "create_ai_watcher", "update_ai_watcher", "delete_ai_watcher"], entities: ["automations", "ai_watchers"] },
  { key: "relations", label: "Relasi & Interaksi", route: "/insights", operations: ["create", "read", "update", "delete"], preferredTools: ["manage_life_os_data"], entities: ["social_relations", "social_interactions", "life_os_entity_links"] },
  { key: "journal", label: "Jurnal", route: "/insights", operations: ["create", "read", "update", "delete"], preferredTools: ["manage_life_os_data"], entities: ["journal_entries"] },
  { key: "planning", label: "Perencana", route: "/planner", operations: ["read"], preferredTools: ["get_daily_brain", "simulate_planner", "get_schedule", "get_tasks"] },
];

const RELATIONSHIPS = ["task ↔ project","task ↔ goal","task ↔ schedule","schedule ↔ reminder","inbox → task","note → task","goal → project","project → task","task → focus","subscription → expense","entity ↔ life_os_entity_links"];
const PRINCIPLES = ["Gunakan tool domain khusus jika tersedia.","Gunakan search/read untuk menemukan UUID nyata sebelum update/delete jika target belum jelas.","Delete destruktif memerlukan konfirmasi sesuai kebijakan chat.","Verifikasi hasil mutation sebelum menyatakan berhasil.","Gunakan get_unified_life_snapshot untuk permintaan lintas modul atau 'semua data'.","Gunakan manage_life_os_data hanya untuk entity yang tidak memiliki tool domain khusus."];

export function getLifeOsCapabilities(input?: { domain?: string; includeFields?: boolean }) {
  const wanted = String(input?.domain || "").trim().toLowerCase();
  const selected = wanted ? CAPABILITIES.filter((x) => x.key === wanted || x.label.toLowerCase().includes(wanted)) : CAPABILITIES;
  if (!selected.length) return { ok: false, error: `Domain "${wanted}" tidak ditemukan.`, available_domains: CAPABILITIES.map((x) => x.key) };
  return {
    ok: true,
    catalog_version: "2.0",
    scope: wanted || "all",
    capabilities: selected.map((x) => {
      const base: Record<string, unknown> = { domain: x.key, label: x.label, route: x.route, operations: x.operations, entities: x.entities, preferred_tools: x.preferredTools };
      if (input?.includeFields && x.key === "health") base.note = "Entity kesehatan tanpa tool update khusus dapat diperbarui melalui manage_life_os_data dengan field yang diizinkan server.";
      return base;
    }),
    relationships: RELATIONSHIPS,
    principles: PRINCIPLES,
  };
}
