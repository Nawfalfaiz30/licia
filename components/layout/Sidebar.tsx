"use client";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LogOut } from "lucide-react";
import { navGroups, isNavPathActive } from "./nav-items";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

export function Sidebar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  async function handleLogout() { await supabase.auth.signOut(); router.replace("/login"); router.refresh(); }
  return (
    <aside className="licia-sidebar fixed inset-y-0 left-0 z-sidebar hidden w-[72px] flex-col border-r border-border bg-surface px-2 py-4 md:flex xl:w-64 xl:px-4 xl:py-6">
      <div className="flex shrink-0 items-center justify-center gap-2.5 px-1 pb-5 xl:justify-start xl:px-2">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-accent/30"><Image src="/licia-avatar.png" alt={t("Licia")} fill className="object-cover" /></div>
        <span className="hidden font-display text-xl text-text xl:inline">{t("Licia")}</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
        {navGroups.map((group) => <section key={group.i18nKey}>
          <p className="mb-1.5 hidden px-2 text-2xs font-bold uppercase tracking-[.12em] text-textMuted xl:block">{t(group.i18nKey)}</p>
          <div className="space-y-1">{group.items.map((item) => {
            const active = isNavPathActive(pathname, item.href); const Icon = item.icon;
            return <a key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={t(item.i18nKey)}
              className={clsx("group flex min-h-11 items-center justify-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors duration-150 xl:justify-start xl:px-3",
                active ? "bg-accent/10 text-accent" : "text-textMuted hover:bg-bg hover:text-text")}>
              <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active && "bg-accent/10")}><Icon size={18} aria-hidden="true" /></span>
              <span className="hidden min-w-0 truncate xl:inline">{t(item.i18nKey)}</span>
            </a>;
          })}</div>
        </section>)}
      </nav>
      <div className="mt-3 shrink-0 border-t border-border pt-3">
        <button type="button" onClick={() => void handleLogout()} title={t("Keluar")}
          className="group flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-2 text-sm text-textMuted transition-colors duration-150 hover:bg-danger/5 hover:text-danger xl:justify-start xl:px-3">
          <LogOut size={16} aria-hidden="true" /><span className="hidden xl:inline">{t("Keluar")}</span>
        </button>
      </div>
    </aside>
  );
}