"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MoreHorizontal } from "lucide-react";
import { mobilePrimaryNavItems, moreNavGroups, isNavPathActive } from "./nav-items";
import { MoreSheet } from "./MoreSheet";
import { useLanguage } from "@/components/LanguageProvider";
import { haptic } from "@/lib/interaction";

export function BottomNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setKeyboardOpen(window.innerHeight - viewport.height > 120);
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);

  const isInMore = !mobilePrimaryNavItems.some((item) => isNavPathActive(pathname, item.href)) &&
    moreNavGroups.some((group) => group.items.some((item) => isNavPathActive(pathname, item.href)));

  return (
    <>
      <nav
        aria-label={t("Navigasi utama")}
        className={clsx("licia-bottom-nav fixed inset-x-0 bottom-0 z-nav border-t border-border bg-surface/98 backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom)]", keyboardOpen && "hidden")}
      >
        <div className="grid h-16 grid-cols-5 gap-0.5 px-1">
          {mobilePrimaryNavItems.map((item) => {
            const active = isNavPathActive(pathname, item.href);
            const Icon = item.icon;
            const emphasis = item.href === "/chat";
            return (
              <Link key={item.href} href={item.href} onPointerDown={() => haptic("selection")} aria-current={active ? "page" : undefined}
                className={clsx("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-2xs font-semibold transition-colors duration-150",
                  active ? "bg-accent/10 text-accent" : "text-textMuted hover:bg-bg hover:text-text", emphasis && "font-bold")}>
                <span className={clsx("flex h-8 w-8 items-center justify-center rounded-xl", emphasis && "bg-accent text-white shadow-sm", active && !emphasis && "bg-accent/10")}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="max-w-full truncate whitespace-nowrap">{t(item.i18nKey)}</span>
              </Link>
            );
          })}
          <button type="button" onPointerDown={() => haptic("selection")} onClick={() => setMoreOpen(true)}
            className={clsx("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-2xs font-semibold transition-colors duration-150",
              isInMore ? "bg-accent/10 text-accent" : "text-textMuted hover:bg-bg hover:text-text")}
            aria-label={t("Buka semua fitur di Lainnya")} aria-expanded={moreOpen}>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-bg"><MoreHorizontal size={18} aria-hidden="true" /></span>
            <span className="max-w-full truncate whitespace-nowrap">{t("Lainnya")}</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}