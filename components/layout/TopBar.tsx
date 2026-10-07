"use client";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NotificationCenter } from "@/components/intelligence/NotificationCenter";
import { PALETTE_OPEN_EVENT } from "@/lib/shortcuts";
import { useLanguage } from "@/components/LanguageProvider";
import { SyncStatusBadge } from "@/components/layout/SyncStatusBadge";
const PAGE_TITLES: Record<string, string> = {
  "/today": "Beranda",
  "/dashboard": "Beranda",
  "/tasks": "Tugas",
  "/calendar": "Kalender",
  "/finance": "Keuangan",
  "/plan": "Rencana",
  "/focus": "Fokus",
  "/goals-projects": "Target & Proyek",
  "/knowledge": "Catatan & Belajar",
  "/wellbeing": "Kesehatan & Rutinitas",
  "/automations": "Otomasi",
  "/life-map": "Peta Hidup",
  "/insights": "Insight",
  "/analytics": "Analitik",
  "/guide": "Panduan",
  "/settings": "Pengaturan",
  "/capture": "Tangkap",
  "/search": "Pencarian",
};
function titleForPath(pathname: string | null) {
  if (!pathname) return "Licia";
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  return Object.entries(PAGE_TITLES).find(([href]) => pathname.startsWith(`${href}/`))?.[1] || "Licia";
}
export function TopBar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  if (pathname === "/chat" || pathname?.startsWith("/chat/")) return null;
  const pageTitle = t(titleForPath(pathname));
  return (
    <header className="relative z-header h-14 px-3 pt-[max(.5rem,env(safe-area-inset-top))] sm:px-6 md:px-8">
      <div className="flex h-full items-center justify-between gap-3 border-b border-border/70">
        <h1 className="min-w-0 truncate font-display text-lg text-text sm:text-xl">{pageTitle}</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <SyncStatusBadge />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT))}
            className="quick-search-control touch-target flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-textMuted shadow-sm transition hover:border-accent hover:text-accent"
            aria-label={t("Cari seluruh Life OS")}
            title={t("Cari seluruh Life OS") + " (Ctrl K)"}
          >
            <Search size={17} aria-hidden />
            <span className="hidden lg:inline text-2xs font-semibold">Ctrl K</span>
          </button>
          <div className="topbar-notification relative">
            <NotificationCenter />
          </div>
        </div>
      </div>
    </header>
  );
}
