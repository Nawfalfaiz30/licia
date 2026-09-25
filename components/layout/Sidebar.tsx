"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { navGroups } from "./nav-items";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="licia-sidebar hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-surface px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 mb-6 shrink-0">
        <div className="relative h-9 w-9 rounded-full overflow-hidden ring-2 ring-accent/30 shrink-0">
          <Image src="/licia-avatar.png" alt="Licia" fill className="object-cover" />
        </div>
        <span className="licia-sidebar-label font-display text-xl text-text">Licia</span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
        {navGroups.map((group) => (
          <div key={t(group.i18nKey)}>
            <p className="licia-sidebar-label text-[11px] text-textMuted uppercase tracking-wide px-3 mb-1.5">{t(group.i18nKey)}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={t(item.i18nKey)}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      active ? "bg-accent/10 text-accent" : "text-textMuted hover:bg-bg hover:text-text"
                    )}
                  >
                    <Icon size={18} />
                    <span className="licia-sidebar-label min-w-0 truncate">{t(item.i18nKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 pt-3 shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-textMuted hover:text-danger transition"
        >
          <LogOut size={16} />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
