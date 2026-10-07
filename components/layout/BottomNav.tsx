"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { CalendarDays, MoreHorizontal } from "lucide-react";
import { allNavItems, moreNavGroups } from "./nav-items";
import { MoreSheet } from "./MoreSheet";
import { useLanguage } from "@/components/LanguageProvider";
import { haptic } from "@/lib/interaction";

export function BottomNav() {
  const { t: tr } = useLanguage();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);

  const coreNav = ["/today", "/chat", "/tasks", "/calendar", "/finance"];
  const visiblePrimary = [
    { href: "/today", label: "Hari Ini", i18nKey: "today", icon: CalendarDays },
    ...coreNav
      .filter((href) => href !== "/today")
      .map((href) => allNavItems.find((item) => item.href === href)),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const isPrimary = visiblePrimary.some((i) => pathname?.startsWith(i.href));
  const isInMore = !isPrimary && moreNavGroups.some((g) => g.items.some((i) => pathname?.startsWith(i.href)));

  return (
    <>
      <nav className="licia-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-nav bg-surface/98 border-t border-border backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {visiblePrimary.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onPointerDown={() => haptic("selection")}
                className={clsx(
                  "licia-v32-interactive licia-v32-ripple mx-0.5 my-1 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-2xs font-medium transition",
                  active ? "bg-accent/10 text-accent" : "text-textMuted hover:bg-bg hover:text-text"
                )}
              >
                <Icon size={20} />
                {item.href === "/today" ? tr("Hari Ini") : t(item.i18nKey)}
              </Link>
            );
          })}
          <button
            onPointerDown={() => haptic("selection")}
            onClick={() => setMoreOpen(true)}
            className={clsx(
              "licia-v32-interactive licia-v32-ripple flex flex-col items-center gap-1 py-2.5 text-2xs font-medium transition",
              isInMore ? "text-accent" : "text-textMuted"
            )}
            aria-label={tr("Buka semua fitur di Lainnya")}
          >
            <MoreHorizontal size={20} />
            {tr("Lainnya")}</button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
