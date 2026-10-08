import {
  LayoutDashboard,
  MessageCircle,
  ListTodo,
  Timer,
  CalendarDays,
  Wallet,
  HeartPulse,
  Settings,
  LibraryBig,
  Target,
  BrainCircuit,
  Lightbulb,
  CircleHelp,
  Search,
  Camera,
  Compass,
  BarChart3,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  i18nKey: string;
  icon: LucideIcon;
  primary?: boolean;
  sub?: boolean;
};
export type NavGroup = { label: string; i18nKey: string; items: NavItem[] };
const item = (
  href: string,
  label: string,
  i18nKey: string,
  icon: LucideIcon,
  primary = false,
  sub = false,
): NavItem => ({ href, label, i18nKey, icon, ...(primary ? { primary: true } : {}), ...(sub ? { sub: true } : {}) });
const group = (label: string, i18nKey: string, items: NavItem[]): NavGroup => ({ label, i18nKey, items });

export const navGroups: NavGroup[] = [
  group("Inti", "nav_core", [
    item("/today", "Hari Ini", "today", LayoutDashboard, true),
    item("/chat", "Chat Licia", "chat", MessageCircle, true),
    item("/tasks", "Tugas", "tasks", ListTodo, true),
    item("/calendar", "Kalender", "calendar", CalendarDays, true),
    item("/finance", "Keuangan", "finance", Wallet, true),
  ]),
  group("Rencana", "nav_plan", [
    item("/plan", "Rencana", "plan", BrainCircuit),
    item("/focus", "Fokus", "focus", Timer),
    item("/goals-projects", "Target & Proyek", "goals_projects", Target),
  ]),
  group("Ruang Hidup", "nav_personal_os", [
    item("/knowledge", "Catatan & Belajar", "knowledge_learning", LibraryBig),
    item("/wellbeing", "Kesehatan & Rutinitas", "health_habits", HeartPulse),
    item("/automations", "Otomasi", "automations", Zap),
    item("/life-map", "Peta Hidup", "life_map", Compass),
    item("/insights", "Insight", "insights", Lightbulb),
  ]),
  group("Bantuan", "nav_system_help", [
    item("/guide", "Panduan", "guide", CircleHelp),
    item("/settings", "Pengaturan", "settings", Settings),
  ]),
];
export const moreNavGroups: NavGroup[] = [
  group("Rencana", "nav_plan", [
    item("/finance", "Keuangan", "finance", Wallet),
    item("/plan", "Rencana", "plan", BrainCircuit),
    item("/focus", "Fokus", "focus", Timer),
    item("/goals-projects", "Target & Proyek", "goals_projects", Target),
    item("/wellbeing", "Kesehatan & Rutinitas", "health_habits", HeartPulse),
    item("/automations", "Pusat Otomasi", "automations_center", Zap),
  ]),
  group("Wawasan", "nav_insights", [
    item("/life-map", "Peta Hidup", "life_map", Compass),
    item("/insights", "Insight", "insights", Lightbulb),
    item("/analytics", "Analitik", "analytics", BarChart3),
  ]),
  group("Ruang kerja", "nav_workspace_main", [
    item("/knowledge", "Catatan & Belajar", "knowledge_learning", LibraryBig),
    item("/capture", "Tangkap", "capture", Camera),
    item("/search", "Pencarian", "search", Search),
  ]),
  group("Bantuan & sistem", "nav_system_help", [
    item("/guide", "Panduan", "guide", CircleHelp),
    item("/settings", "Pengaturan", "settings", Settings),
  ]),
];
export const allNavItems = navGroups.flatMap((g) => g.items);
export const primaryNavItems = allNavItems.filter((i) => i.primary);
export const mobilePrimaryNavItems = [
  navGroups[0].items.find((i) => i.href === "/today")!,
  navGroups[0].items.find((i) => i.href === "/tasks")!,
  navGroups[0].items.find((i) => i.href === "/chat")!,
  navGroups[0].items.find((i) => i.href === "/calendar")!,
];
export const allFeatureItems = moreNavGroups.flatMap((g) => g.items);
export const featureGroups = moreNavGroups;
export function isNavPathActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/today") return pathname === "/today" || pathname === "/dashboard" || pathname === "/";
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/today" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
