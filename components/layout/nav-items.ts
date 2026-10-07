import {
  LayoutDashboard, MessageCircle, ListTodo, Timer, CalendarDays, Wallet, HeartPulse, Settings,
  LibraryBig, Target, BrainCircuit, Lightbulb, CircleHelp, Search, Camera, Compass, BarChart3, Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; i18nKey: string; icon: LucideIcon; primary?: boolean; sub?: boolean };
export type NavGroup = { label: string; i18nKey: string; items: NavItem[] };

const item = (href: string, label: string, i18nKey: string, icon: LucideIcon, primary = false, sub = false): NavItem => ({
  href, label, i18nKey, icon, ...(primary ? { primary: true } : {}), ...(sub ? { sub: true } : {}),
});
const group = (label: string, i18nKey: string, items: NavItem[]): NavGroup => ({ label, i18nKey, items });

export const navGroups: NavGroup[] = [
  group("Inti", "nav_core", [
    item("/today", "Beranda", "home", LayoutDashboard, true),
    item("/tasks", "Tugas", "tasks", ListTodo, true),
    item("/chat", "Chat Licia", "chat", MessageCircle, true),
    item("/calendar", "Kalender", "calendar", CalendarDays, true),
    item("/finance", "Keuangan", "finance", Wallet, true),
  ]),
  group("Rencana", "nav_plan", [
    item("/plan", "Rencana", "plan", BrainCircuit), item("/focus", "Fokus", "focus", Timer),
    item("/goals-projects", "Target & Proyek", "goals_projects", Target),
  ]),
  group("Ruang Hidup", "nav_personal_os", [
    item("/knowledge", "Catatan & Belajar", "knowledge_learning", LibraryBig),
    item("/wellbeing", "Kesehatan & Rutinitas", "health_habits", HeartPulse),
    item("/automations", "Otomasi", "automations", Zap),
    item("/life-map", "Peta Hidup", "life_map", Compass),
    item("/insights", "Insight", "insights", Lightbulb),
  ]),
  group("Bantuan", "nav_system_help", [item("/guide", "Panduan", "guide", CircleHelp), item("/settings", "Pengaturan", "settings", Settings)]),
];

export const moreNavGroups: NavGroup[] = [
  group("Lainnya", "nav_other", [
    item("/finance", "Keuangan", "finance", Wallet), item("/plan", "Rencana", "plan", BrainCircuit), item("/focus", "Fokus", "focus", Timer),
    item("/goals-projects", "Target & Proyek", "goals_projects", Target), item("/wellbeing", "Kesehatan & Rutinitas", "health_habits", HeartPulse),
    item("/automations", "Pusat Otomasi", "automations_center", Zap), item("/life-map", "Peta Hidup", "life_map", Compass),
    item("/insights", "Insight", "insights", Lightbulb), item("/guide", "Panduan", "guide", CircleHelp), item("/settings", "Pengaturan", "settings", Settings),
  ]),
  group("Akses cepat", "nav_workspace_main", [
    item("/capture", "Tangkap Cepat", "capture", Camera), item("/knowledge", "Catatan & Belajar", "knowledge_learning", LibraryBig),
    item("/search", "Pencarian", "search", Search), item("/analytics", "Analitik Pribadi", "analytics", BarChart3),
  ]),
];

export const allNavItems = navGroups.flatMap((g) => g.items);
export const primaryNavItems = navGroups[0].items.filter((x) => x.primary);
export const mobilePrimaryNavItems = [
  navGroups[0].items.find((x) => x.href === "/today")!,
  navGroups[0].items.find((x) => x.href === "/tasks")!,
  navGroups[0].items.find((x) => x.href === "/chat")!,
  navGroups[0].items.find((x) => x.href === "/calendar")!,
];
export const allFeatureItems = moreNavGroups.flatMap((g) => g.items);
export const featureGroups = moreNavGroups;

export function isNavPathActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/today") return pathname === "/today" || pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}