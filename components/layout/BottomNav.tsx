"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MoreHorizontal } from "lucide-react";
import { mobilePrimaryNavItems, isNavPathActive } from "./nav-items";
import { MoreSheet } from "./MoreSheet";
import { useLanguage } from "@/components/LanguageProvider";
import { haptic } from "@/lib/interaction";
export function BottomNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isPrimary = mobilePrimaryNavItems.some((i) => isNavPathActive(pathname, i.href));
  const isInMore = Boolean(pathname) && !isPrimary;
  return (
    <>
      <nav
        aria-label={t("Navigasi utama")}
        className="licia-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-nav border-t border-border bg-surface/98 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid h-16 grid-cols-5 px-1">
          {mobilePrimaryNavItems.map((item, index) => {
            const Icon = item.icon;
            const active = isNavPathActive(pathname, item.href);
            const emphasis = index === 2;
            return (
              <Link
                key={item.href}
                href={item.href}
                onPointerDown={() => haptic("selection")}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "licia-nav-item flex min-w-0 min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold leading-none",
                  active ? "text-accent" : "text-textMuted hover:bg-bg hover:text-text",
                  emphasis && "my-1.5 border border-accent/20 bg-accent/5 text-accent",
                )}
              >
                <span
                  className={clsx(
                    "grid h-7 w-7 place-items-center rounded-xl",
                    active && "bg-accent/10",
                    emphasis && "h-8 w-8 rounded-2xl bg-accent text-white shadow-sm",
                  )}
                >
                  <Icon size={18} strokeWidth={active || emphasis ? 2.4 : 2} />
                </span>
                <span className="max-w-full truncate">{index === 0 ? t("Beranda") : t(item.i18nKey)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onPointerDown={() => haptic("selection")}
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-controls="licia-more-sheet"
            aria-label={t("Buka semua fitur di Lainnya")}
            className={clsx(
              "licia-nav-item flex min-w-0 min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold leading-none",
              isInMore || moreOpen ? "text-accent" : "text-textMuted hover:bg-bg hover:text-text",
            )}
          >
            <span
              className={clsx("grid h-7 w-7 place-items-center rounded-xl", (isInMore || moreOpen) && "bg-accent/10")}
            >
              <MoreHorizontal size={18} />
            </span>
            <span className="max-w-full truncate">{t("Lainnya")}</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
