"use client";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NotificationCenter } from "@/components/intelligence/NotificationCenter";
import { PALETTE_OPEN_EVENT } from "@/lib/shortcuts";
import { useLanguage } from "@/components/LanguageProvider";
import { SyncStatusBadge } from "@/components/layout/SyncStatusBadge";
import { clsx } from "clsx";

export function TopBar() {
  const { t } = useLanguage(); const pathname = usePathname();
  if (pathname === "/chat" || pathname?.startsWith("/chat/")) return null;
  const labels: Array<[string,string]> = [
    ["/today","Beranda"],["/tasks","Tugas"],["/calendar","Kalender"],["/finance","Keuangan"],["/plan","Rencana"],["/focus","Fokus"],
    ["/goals-projects","Target & Proyek"],["/knowledge","Catatan & Belajar"],["/wellbeing","Kesehatan & Rutinitas"],["/automations","Otomasi"],
    ["/life-map","Peta Hidup"],["/insights","Insight"],["/guide","Panduan"],["/settings","Pengaturan"],
  ];
  const title = labels.find(([href]) => pathname === href || pathname?.startsWith(href + "/"))?.[1] || "Licia";
  return <header className="licia-topbar sticky top-0 z-header px-3 pt-[max(.5rem,env(safe-area-inset-top))] sm:px-6 md:px-8">
    <div className="flex h-14 items-center justify-between gap-3 border-b border-border/80 bg-bg/92 backdrop-blur-xl">
      <div className="min-w-0"><p className="hidden text-2xs font-semibold text-textMuted md:block">{t("Licia")}</p><h1 className="truncate font-display text-lg text-text">{t(title)}</h1></div>
      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT))}
          className={clsx("hidden min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted transition-colors duration-150 hover:border-accent hover:text-accent md:flex")}
          aria-label={t("Cari seluruh Life OS")} title={t("Cari seluruh Life OS") + " (Ctrl K)"}>
          <Search size={15} aria-hidden="true" /><span>{t("Cari")}</span><kbd className="rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-textMuted md:hidden" aria-label={t("Cari")}>
          <Search size={16} aria-hidden="true" />
        </button>
        <SyncStatusBadge /><NotificationCenter />
      </div>
    </div>
  </header>;
}