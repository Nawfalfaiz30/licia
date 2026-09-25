"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MoreHorizontal } from "lucide-react";
import { primaryNavItems, moreNavGroups } from "./nav-items";
import { MoreSheet } from "./MoreSheet";
import { useLanguage } from "@/components/LanguageProvider";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);

  const isInMore = moreNavGroups.some((g) => g.items.some((i) => pathname?.startsWith(i.href)));

  return (
    <>
      <nav className="licia-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-border">
        <div className="grid grid-cols-5">
          {primaryNavItems.slice(0, 4).map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                  active ? "text-accent" : "text-textMuted"
                )}
              >
                <Icon size={20} />
                {t(item.i18nKey)}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={clsx(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
              isInMore ? "text-accent" : "text-textMuted"
            )}
          >
            <MoreHorizontal size={20} />
            {t("nav_other")}
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
