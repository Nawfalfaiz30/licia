"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MoreHorizontal } from "lucide-react";
import { primaryNavItems, moreNavGroups } from "./nav-items";
import { MoreSheet } from "./MoreSheet";
import { useLanguage } from "@/components/LanguageProvider";
import { haptic } from "@/lib/interaction";

export function BottomNav() {
  const { tr } = useLanguage();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);

  const mobilePrimaryOrder = ["/dashboard", "/plan", "/chat", "/insights"];
  const visiblePrimary = mobilePrimaryOrder.map((href) => primaryNavItems.find((item) => item.href === href)).filter((item): item is typeof primaryNavItems[number] => Boolean(item));
  const isPrimary = visiblePrimary.some((i) => pathname?.startsWith(i.href));
  const isInMore = !isPrimary && moreNavGroups.some((g) => g.items.some((i) => pathname?.startsWith(i.href)));

  return (
    <>
      <nav className="licia-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-20 bg-surface/98 border-t border-border backdrop-blur-xl">
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
                  "licia-v32-interactive licia-v32-ripple flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                  active ? "text-accent" : "text-textMuted"
                )}
              >
                <Icon size={20} />
                {t(item.i18nKey)}
              </Link>
            );
          })}
          <button
            onPointerDown={() => haptic("selection")}
            onClick={() => setMoreOpen(true)}
            className={clsx(
              "licia-v32-interactive licia-v32-ripple flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
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
