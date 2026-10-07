"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { navGroups, isNavPathActive } from "./nav-items";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
export function Sidebar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <aside className="licia-sidebar hidden md:flex md:w-[72px] xl:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 border-r border-border bg-surface px-2 py-5 xl:px-4 xl:py-6">
      <div className="mb-5 flex shrink-0 items-center justify-center gap-2.5 px-1 xl:justify-start xl:px-2">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-accent/30">
          <Image src="/licia-avatar.png" alt={t("Licia")} fill className="object-cover" />
        </div>
        <span className="licia-sidebar-label hidden xl:block font-display text-xl text-text">{t("Licia")}</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto overscroll-contain no-scrollbar">
        {navGroups.map((g) => (
          <div key={g.i18nKey}>
            <p className="licia-sidebar-label hidden xl:block mb-1.5 px-3 text-2xs uppercase tracking-wide text-textMuted">
              {t(g.i18nKey)}
            </p>
            <div className="space-y-1">
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = isNavPathActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={t(item.i18nKey)}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "group flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition xl:px-3 justify-center xl:justify-start",
                      active ? "bg-accent/10 text-accent" : "text-textMuted hover:bg-bg hover:text-text",
                    )}
                  >
                    <span
                      className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-xl", active && "bg-accent/10")}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="licia-sidebar-label hidden min-w-0 truncate xl:block">{t(item.i18nKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="sticky bottom-0 mt-3 flex shrink-0 items-center justify-center border-t border-border bg-surface pt-3 xl:justify-between xl:px-2">
        <div className="hidden items-center gap-2 xl:flex">
          <div className="relative h-8 w-8 overflow-hidden rounded-full ring-1 ring-border">
            <Image src="/licia-avatar.png" alt="" fill className="object-cover" />
          </div>
          <span className="text-2xs text-textMuted">{t("Sesi aktif")}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title={t("Keluar")}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-2.5 text-sm text-textMuted hover:bg-danger/5 hover:text-danger"
        >
          <LogOut size={16} />
          <span className="licia-sidebar-label hidden xl:inline">{t("Keluar")}</span>
        </button>
      </div>
    </aside>
  );
}
