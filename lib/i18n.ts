import { enPhrases } from "@/lib/locales/en";

export type Language = "id" | "en";
export const LANGUAGE_STORAGE_KEY = "licia-language";
/** Cookie agar komponen server (SSR) tahu bahasa pengguna tanpa menunggu klien. */
export const LANGUAGE_COOKIE = "licia-language";
export const LOCALE_BY_LANGUAGE: Record<Language, string> = { id: "id-ID", en: "en-US" };
export type TranslateParams = Record<string, string | number | null | undefined>;

export const translations: Record<Language, Record<string, string>> = {
  id: {
    nav_rhythm: "Ritme",
    nav_main: "Utama",
    nav_insights_automation: "Insights & Otomasi",
    nav_system_help: "Bantuan",
    nav_personal_os: "Ruang Hidup",
    nav_finance_health: "Keuangan & Kesehatan",
    nav_personal: "Pribadi",
    nav_other: "Lainnya",
    nav_workspace_main: "Workspace utama",
    nav_insights: "Wawasan & Otomasi",
    calendar_reminders: "Kalender & Pengingat",
    planner_inbox: "Perencana & Inbox",
    life_map_relations: "Peta & Relasi",
    review_patterns: "Review & Pola",
    home: "Beranda",
    plan: "Rencana",
    nav_plan: "Rencana",
    nav_goals_knowledge: "Tujuan & Pengetahuan",
    goals_projects: "Target & Proyek",
    knowledge: "Knowledge & Belajar",
    knowledge_learning: "Knowledge & Belajar",
    health_habits: "Kesehatan & Rutinitas",
    ai_history: "Riwayat AI",
    today: "Hari Ini",
    chat: "Chat Licia",
    life_command: "Perintah Licia",
    capture: "Tangkap Cepat",
    life_pulse: "Denyut Hidup",
    inbox: "Kotak Masuk Cerdas",
    tasks: "Tugas",
    calendar: "Kalender",
    focus: "Fokus",
    projects: "Proyek",
    planner: "Perencana Mingguan AI",
    brief: "Tinjauan & Ringkasan",
    life_map: "Peta Hidup",
    timeline: "Linimasa",
    analytics: "Analitik Pribadi",
    insights: "Insights",
    decisions: "Jurnal Keputusan",
    learning: "Belajar & Keahlian",
    memory: "Memori Licia",
    vault: "Brankas Licia",
    automations: "Pusat Otomatisasi",
    life_graph: "Peta Koneksi",
    finance: "Keuangan",
    subscriptions: "Langganan",
    health: "Kesehatan",
    goals: "Target",
    notes: "Catatan",
    reading: "Bacaan",
    habits: "Rutinitas",
    reminders: "Pengingat",
    system_center: "Pusat Sistem",
    sync_center: "Pusat Sinkronisasi",
    settings: "Pengaturan",
    logout: "Keluar",
    settings_title: "Pengaturan",
    settings_subtitle: "Atur tampilan dan cara kerja Licia.",
    language: "Bahasa",
    language_description: "Pilih bahasa antarmuka Licia.",
    start_page: "Halaman awal",
    week_start: "Awal minggu",
    default_focus: "Durasi fokus bawaan",
    focus_sound: "Suara fokus",
    focus_sound_repeats: "Pengulangan suara selesai",
    density: "Kepadatan UI",
    reduced_motion: "Kurangi animasi",
    confirm_delete: "Konfirmasi hapus",
    time_format: "Format waktu",
    compact_sidebar: "Sidebar ringkas",
    quick_search: "Pencarian cepat",
    auto_complete_focus: "Selesaikan tugas saat Focus selesai",
    show_clock_seconds: "Tampilkan detik pada jam",
    theme: "Tema",
    timezone: "Zona waktu",
    appearance: "Penampilan",
    behavior: "Perilaku aplikasi",
    saved: "Preferensi tersimpan",
    saving: "Menyimpan preferensi…",
    name: "Nama panggilan",
    data: "Data",
    account: "Akun",
  },
  en: {
    nav_rhythm: "Rhythm",
    nav_main: "Main",
    nav_insights_automation: "Insights & Automation",
    nav_system_help: "Help",
    nav_personal_os: "Personal OS",
    nav_finance_health: "Finance & Health",
    nav_personal: "Personal",
    nav_other: "Other",
    nav_workspace_main: "Main workspaces",
    nav_insights: "Insights & Automations",
    calendar_reminders: "Calendar & Reminders",
    planner_inbox: "Planner & Inbox",
    life_map_relations: "Map & Relations",
    review_patterns: "Review & Patterns",
    home: "Home",
    plan: "Plan",
    nav_plan: "Plan",
    nav_goals_knowledge: "Goals & Knowledge",
    goals_projects: "Goals & Projects",
    knowledge: "Knowledge & Learning",
    knowledge_learning: "Knowledge & Learning",
    health_habits: "Health & Routines",
    ai_history: "AI History",
    today: "Today",
    chat: "Licia Chat",
    life_command: "Licia Command",
    capture: "Quick Capture",
    life_pulse: "Life Pulse",
    inbox: "Smart Inbox",
    tasks: "Tasks",
    calendar: "Calendar",
    focus: "Focus",
    projects: "Projects",
    planner: "AI Weekly Planner",
    brief: "Review & Brief",
    life_map: "Life Map",
    timeline: "Timeline",
    analytics: "Personal Analytics",
    insights: "Insights",
    decisions: "Decision Journal",
    learning: "Learning & Skills",
    memory: "Licia Memory",
    vault: "Licia Vault",
    automations: "Automation Center",
    life_graph: "Life Graph",
    finance: "Finance",
    subscriptions: "Subscriptions",
    health: "Health",
    goals: "Goals",
    notes: "Notes",
    reading: "Reading",
    habits: "Routines",
    reminders: "Reminders",
    system_center: "System Center",
    sync_center: "Sync Center",
    settings: "Settings",
    logout: "Log out",
    settings_title: "Settings",
    settings_subtitle: "Set how Licia looks and works.",
    language: "Language",
    language_description: "Choose Licia's interface language.",
    start_page: "Start page",
    week_start: "Week starts on",
    default_focus: "Default focus duration",
    focus_sound: "Focus completion sound",
    focus_sound_repeats: "Completion sound repeats",
    density: "UI density",
    reduced_motion: "Reduce motion",
    confirm_delete: "Confirm destructive actions",
    time_format: "Time format",
    compact_sidebar: "Compact sidebar",
    quick_search: "Quick search",
    auto_complete_focus: "Complete task when Focus finishes",
    show_clock_seconds: "Show seconds on clock",
    theme: "Theme",
    timezone: "Time zone",
    appearance: "Appearance",
    behavior: "App behavior",
    saved: "Preferences saved",
    saving: "Saving preferences…",
    name: "Display name",
    data: "Data",
    account: "Account",
  },
};

export function resolveLanguage(value: unknown): Language {
  return value === "en" ? "en" : "id";
}

/** Ganti {nama} dengan nilai params. Placeholder tak dikenal dibiarkan apa adanya. */
export function interpolate(text: string, params?: TranslateParams): string {
  if (!params) return text;
  return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key: string) => (key in params ? String(params[key] ?? "") : match));
}

/**
 * Terjemahan dua jenis kunci:
 *  - kunci pendek lama (`"home"`, `"tasks"`) dari tabel `translations`;
 *  - teks Indonesia apa adanya (`"Tugas selesai"`) sebagai kunci, dengan padanan Inggris di `lib/locales/en.ts`.
 * Bahasa Indonesia mengembalikan kunci itu sendiri, sehingga teks tak pernah hilang meski belum diterjemahkan.
 */
export function t(key: string, language: Language = "id", params?: TranslateParams): string {
  const base = language === "en"
    ? (translations.en[key] ?? enPhrases[key] ?? translations.id[key] ?? key)
    : (translations.id[key] ?? key);
  return interpolate(base, params);
}

export function localeOf(language: Language): string {
  return LOCALE_BY_LANGUAGE[language] ?? LOCALE_BY_LANGUAGE.id;
}

export function applyLanguage(language: Language = "id") {
  const root = document.documentElement;
  root.lang = language;
  root.dataset.language = language;
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch {}
  try { document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`; } catch {}
  window.dispatchEvent(new CustomEvent("licia:language-change", { detail: language }));
}
