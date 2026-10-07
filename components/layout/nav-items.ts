import {
  LayoutDashboard, MessageCircle, ListTodo, Timer, CalendarDays, Wallet, HeartPulse, Settings,
  LibraryBig, Target, BrainCircuit, Lightbulb, CircleHelp, Search, Camera,
  Compass, BarChart3, Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; i18nKey: string; icon: LucideIcon; primary?: boolean; sub?: boolean };
export type NavGroup = { label: string; i18nKey: string; items: NavItem[] };

const item = (href: string, label: string, i18nKey: string, icon: LucideIcon, primary = false, sub = false): NavItem =>
  ({ href, label, i18nKey, icon, ...(primary ? { primary: true } : {}), ...(sub ? { sub: true } : {}) });

const group = (label: string, i18nKey: string, items: NavItem[]): NavGroup => ({ label, i18nKey, items });

/**
 * One canonical desktop navigation. A merged workspace owns its former child
 * features; old routes remain reachable for compatibility but are not surfaced
 * as duplicate destinations.
 */
export const navGroups: NavGroup[] = [
  group("Inti", "nav_core", [
    item("/today", "Hari Ini", "today", CalendarDays, true),
    item("/chat", "Chat Licia", "chat", MessageCircle, true),
    item("/tasks", "Tugas", "tasks", ListTodo, true),
    item("/calendar", "Kalender", "calendar", CalendarDays, true),
    item("/knowledge", "Catatan", "knowledge", LibraryBig, true),
    item("/finance", "Keuangan", "finance", Wallet, true),
  ]),
  group("Rencana", "nav_plan", [
    item("/plan", "Rencana", "plan", BrainCircuit),
    item("/focus", "Fokus", "focus", Timer),
    item("/goals-projects", "Target & Proyek", "goals_projects", Target),
  ]),
  group("Ruang Hidup", "nav_personal_os", [
    item("/wellbeing", "Kesehatan & Rutinitas", "health_habits", HeartPulse),
    item("/automations", "Otomasi", "automations", Zap),
    item("/life-map", "Peta", "life_map", Compass),
    item("/insights", "Insights", "insights", Lightbulb),
  ]),
  group("Bantuan", "nav_system_help", [
    item("/guide", "Panduan", "guide", CircleHelp),
    item("/settings", "Pengaturan", "settings", Settings),
  ]),
];

/**
 * Mobile discovery catalog. It intentionally shows only canonical workspaces
 * and a small number of genuinely useful combined entry points. Merged child
 * modules such as Langganan, Notes, Memory, Vault, Habits, Reading, Projects,
 * Goals, Analytics, Timeline, etc. are not resurrected as duplicate cards.
 */
export const moreNavGroups: NavGroup[] = [
  group("Workspace utama", "nav_workspace_main", [
    item("/dashboard", "Beranda", "home", LayoutDashboard),
    item("/plan", "Rencana", "plan", ListTodo),
    item("/chat", "Chat Licia", "chat", MessageCircle),
    item("/capture", "Tangkap", "capture", Camera),
    item("/insights", "Insights", "insights", Lightbulb),
  ]),
  group("Rencana", "nav_plan", [
    item("/tasks", "Tugas", "tasks", ListTodo),
    item("/calendar", "Kalender & Pengingat", "calendar_reminders", CalendarDays, false, true),
    item("/focus", "Fokus", "focus", Timer, false, true),
    item("/plan", "Perencana & Inbox", "planner_inbox", BrainCircuit, false, true),
  ]),
  group("Ruang Hidup", "nav_personal_os", [
    item("/goals-projects", "Target & Proyek", "goals_projects", Target),
    item("/knowledge", "Knowledge & Belajar", "knowledge_learning", LibraryBig),
    item("/finance", "Keuangan", "finance", Wallet),
    item("/wellbeing", "Kesehatan & Rutinitas", "health_habits", HeartPulse),
  ]),
  group("Wawasan & Otomasi", "nav_insights", [
    item("/life-map", "Peta & Relasi", "life_map_relations", Compass, false, true),
    item("/analytics", "Review & Pola", "review_patterns", BarChart3, false, true),
    item("/automations", "Otomasi", "automations", Zap, false, true),
  ]),
  group("Sistem", "nav_system_help", [
    item("/search", "Pencarian", "search", Search),
    item("/guide", "Panduan", "guide", CircleHelp),
    item("/settings", "Pengaturan", "settings", Settings),
  ]),
];

export const allNavItems = navGroups.flatMap((g) => g.items);
export const primaryNavItems = allNavItems.filter((i) => i.primary);
export const allFeatureItems = moreNavGroups.flatMap((g) => g.items);
export const featureGroups = moreNavGroups;
