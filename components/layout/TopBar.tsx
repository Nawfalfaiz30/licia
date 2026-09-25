"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { NotificationCenter } from "@/components/intelligence/NotificationCenter";
import { QuickSearch } from "@/components/layout/QuickSearch";

export function TopBar(){
  return (
    <header className="relative z-[100] licia-topbar px-3 pt-[max(.65rem,env(safe-area-inset-top))] sm:px-6 sm:pt-4 md:ml-auto md:max-w-6xl md:px-8">
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-border/80 bg-surface/95 px-2 py-1.5 shadow-sm backdrop-blur-xl sm:px-2.5 md:border-transparent md:bg-transparent md:px-0 md:py-0 md:shadow-none md:backdrop-blur-0">
        <Link href="/chat" className="topbar-licia group inline-flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-2.5 py-2 text-xs font-semibold text-text transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/10 md:hidden">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10 ring-1 ring-accent/15">
            <Sparkles size={14} className="text-accent transition group-hover:scale-110" />
          </span>
          <span className="truncate">Tanya Licia</span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link href="/chat" className="hidden min-h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted transition hover:-translate-y-0.5 hover:border-accent hover:text-accent md:flex">
            <Sparkles size={14}/><span>Tanya Licia</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <QuickSearch />
          </div>
          <div className="topbar-notification relative">
            <NotificationCenter />
          </div>
        </div>
      </div>
    </header>
  );
}
