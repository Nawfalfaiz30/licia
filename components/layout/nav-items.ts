import { LayoutDashboard, MessageCircle, CheckSquare, Timer, CalendarDays, Wallet, HeartPulse, Settings, StickyNote, BookOpen, Repeat, Target, Repeat2, Sparkles, Inbox, BrainCircuit, FolderKanban, Brain, Zap, BookMarked, Waypoints, GraduationCap, BarChart3, Scale, Compass, CircleHelp, Command, Camera, Activity, Server as ServerIcon, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; i18nKey: string; icon: LucideIcon; primary?: boolean };
export type NavGroup = { label: string; i18nKey: string; items: NavItem[] };

const item = (href: string, label: string, i18nKey: string, icon: LucideIcon, primary = false): NavItem => ({ href, label, i18nKey, icon, ...(primary ? { primary: true } : {}) });
const group = (label: string, i18nKey: string, items: NavItem[]): NavGroup => ({ label, i18nKey, items });

export const navGroups: NavGroup[] = [
  group("Ritme", "nav_rhythm", [
    item("/dashboard", "Beranda", "home", LayoutDashboard, true),
    item("/today", "Hari Ini", "today", Sparkles, true),
    item("/chat", "Chat Licia", "chat", MessageCircle, true),
    item("/command", "Life Command", "life_command", Command),
    item("/capture", "Capture Studio", "capture", Camera),
    item("/inbox", "Smart Inbox", "inbox", Inbox),
    item("/tasks", "Tugas", "tasks", CheckSquare),
    item("/calendar", "Kalender", "calendar", CalendarDays),
    item("/focus", "Fokus", "focus", Timer, true),
    item("/projects", "Proyek", "projects", FolderKanban),
    item("/planner", "Perencana Mingguan AI", "planner", BrainCircuit),
    item("/brief", "Brief & Review", "brief", Sparkles),
    item("/pulse", "Life Pulse", "life_pulse", Activity),
  ]),
  group("Personal OS", "nav_personal_os", [
    item("/life-map", "Peta Kehidupan", "life_map", Compass),
    item("/timeline", "Linimasa", "timeline", Waypoints),
    item("/analytics", "Analitik Pribadi", "analytics", BarChart3),
    item("/insights", "Pusat Insight", "insights", BrainCircuit),
    item("/decisions", "Jurnal Keputusan", "decisions", Scale),
    item("/learning", "Belajar & Keahlian", "learning", GraduationCap),
    item("/memory", "Memori Licia", "memory", Brain),
    item("/vault", "Brankas Licia", "vault", BookMarked),
    item("/automations", "Pusat Otomatisasi", "automations", Zap),
    item("/life-graph", "Life Graph", "life_graph", Waypoints),
  ]),
  group("Keuangan & Kesehatan", "nav_finance_health", [
    item("/finance", "Keuangan", "finance", Wallet),
    item("/subscriptions", "Langganan", "subscriptions", Repeat2),
    item("/health", "Kesehatan", "health", HeartPulse),
  ]),
  group("Personal", "nav_personal", [
    item("/goals", "Target", "goals", Target),
    item("/notes", "Catatan", "notes", StickyNote),
    item("/reading", "Bacaan", "reading", BookOpen),
    item("/habits", "Rutinitas", "habits", Repeat),
  ]),
  group("Lainnya", "nav_other", [item("/reminders", "Pengingat", "reminders", Timer), item("/system", "System Center", "system_center", ServerIcon), item("/guide", "Panduan", "guide", CircleHelp), item("/settings", "Pengaturan", "settings", Settings)]),
];

export const allNavItems = navGroups.flatMap((g) => g.items);
export const primaryNavItems = allNavItems.filter((i) => i.primary);
export const moreNavGroups = navGroups.map((g) => ({ ...g, items: g.items.filter((i) => !i.primary) })).filter((g) => g.items.length > 0);
