
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LogOut, X } from "lucide-react";
import { moreNavGroups } from "./nav-items";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const supabase = createClient();
  if (!open) return null;

  async function logout() {
    await supabase.auth.signOut();
    onClose();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="md:hidden fixed inset-0 z-[170]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 rounded-t-[1.75rem] border-t border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl max-h-[84vh] overflow-y-auto animate-licia-sheet-up">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-center justify-between mb-4"><div><p className="font-display text-lg text-text">{t("nav_other")}</p><p className="text-[10px] text-textMuted">Semua area Licia ada di sini.</p></div><button onClick={onClose} className="touch-target rounded-xl text-textMuted hover:text-text" aria-label="Tutup"><X size={20}/></button></div>
        <div className="space-y-5">
          {moreNavGroups.map((group) => <div key={t(group.i18nKey)}><p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-textMuted">{t(group.i18nKey)}</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">{group.items.map((item) => { const active = pathname?.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={onClose} className={clsx("flex min-h-[74px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition active:scale-[.985]", active?"border-accent/25 bg-accent/10 text-accent":"border-border bg-bg text-textMuted hover:border-accent/20 hover:text-text")}><Icon size={19}/><span className="break-words text-[10px] font-semibold leading-tight">{t(item.i18nKey)}</span></Link> })}</div></div>)}
        </div>
        <button onClick={() => void logout()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-danger/15 bg-danger/5 text-sm font-semibold text-danger transition active:scale-[.985]"><LogOut size={16}/> Keluar / Log out</button>
      </div>
    </div>
  );
}
