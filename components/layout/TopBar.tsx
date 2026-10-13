"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Moon, Search, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { NotificationCenter } from "@/components/intelligence/NotificationCenter";
import { PALETTE_OPEN_EVENT } from "@/lib/shortcuts";
import { useLanguage } from "@/components/LanguageProvider";
import { SyncStatusBadge } from "@/components/layout/SyncStatusBadge";
import { applyThemePreference } from "@/lib/theme";

const PAGE_TITLES: Record<string, string> = {
  "/today": "Hari Ini",
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
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (pathname === "/chat" || pathname?.startsWith("/chat/")) return null;
  const pageTitle = t(titleForPath(pathname));

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    applyThemePreference(next);
    setIsDark(next === "dark");
  }

  return (
    <header className="relative z-header h-16 px-3 pt-[max(.5rem,env(safe-area-inset-top))] sm:px-6 md:px-8">
      <div className="flex h-full items-center justify-between gap-3 border-b border-border/70">
        <nav aria-label={t("Breadcrumb")} className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden shrink-0 text-textMuted sm:inline">Workspace</span>
          <ChevronRight className="hidden shrink-0 text-textMuted sm:block" size={15} aria-hidden />
          <h1 className="min-w-0 truncate font-display text-base font-semibold text-text sm:text-lg">{pageTitle}</h1>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SyncStatusBadge />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT))}
            className="quick-search-control touch-target flex min-w-[104px] items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 text-sm text-textMuted shadow-sm transition hover:border-accent hover:text-text sm:min-w-[160px] md:min-w-[208px]"
            aria-label={t("Cari seluruh Life OS")}
            title={t("Cari seluruh Life OS") + " (Ctrl K)"}
          >
            <span className="flex items-center gap-2">
              <Search size={17} aria-hidden />
              <span>{t("Cari")}</span>
            </span>
            <kbd className="hidden rounded-md border border-border bg-bg px-1.5 py-0.5 text-2xs font-medium sm:inline">Ctrl K</kbd>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="touch-target grid place-items-center rounded-xl text-textMuted transition hover:bg-surface hover:text-text"
            aria-label={t(isDark ? "Mode terang" : "Mode gelap")}
            title={t(isDark ? "Mode terang" : "Mode gelap")}
          >
            {isDark ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
          </button>
          <div className="topbar-notification relative">
            <NotificationCenter />
          </div>
        </div>
      </div>
    </header>
  );
}
