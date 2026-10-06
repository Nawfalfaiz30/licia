"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Grid2X2, LogOut, Search, X, ArrowRight } from "lucide-react";
import { moreNavGroups } from "./nav-items";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { Overlay } from "@/components/ui/Overlay";

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t: tr } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const supabase = createClient();
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => moreNavGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !q || `${item.label} ${t(item.i18nKey)} ${group.label}`.toLowerCase().includes(q)),
  })).filter((group) => group.items.length), [q, t]);

  async function logout() {
    await supabase.auth.signOut();
    onClose();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Overlay open={open} onClose={onClose} tier="sheet" align="end" flush visibilityClassName="md:hidden" label={t("Lainnya")} panelClassName="w-full">
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[1.65rem] border-t border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl animate-licia-sheet-up">
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-border" />
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Grid2X2 size={18}/></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><p className="font-display text-lg text-text">{tr("Lainnya")}</p><span className="rounded-full bg-bg px-2 py-0.5 text-2xs font-semibold text-textMuted">{tr("Semua fitur")}</span></div>
            <p className="mt-0.5 text-2xs leading-relaxed text-textMuted">{tr("Semua pintasan utama Licia ada di sini. Fitur yang sudah digabung tetap tersedia dari workspace induknya, bukan sebagai menu duplikat.")}</p>
          </div>
          <button onClick={onClose} className="touch-target shrink-0 rounded-xl border border-border bg-bg text-textMuted hover:text-text" aria-label={tr("Tutup")}><X size={18}/></button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-bg px-3 shadow-inner">
          <Search size={15} className="shrink-0 text-textMuted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("Cari fitur atau workspace…")} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-textMuted" aria-label={tr("Cari fitur atau workspace")} />
          {query && <button onClick={() => setQuery("")} className="rounded-lg px-2 py-1 text-2xs font-semibold text-textMuted hover:text-text">{tr("Hapus")}</button>}
        </div>

        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <section key={group.i18nKey}>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-2xs font-bold uppercase tracking-[.15em] text-textMuted">{t(group.i18nKey)}</p>
                <span className="text-2xs text-textMuted">{tr("{items_length} pilihan", { items_length: group.items.length })}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  const targetPath = item.href.split("#")[0];
                  const active = Boolean(pathname?.startsWith(targetPath));
                  const Icon = item.icon;
                  return (
                    <Link key={`${item.href}-${item.label}`} href={item.href} onClick={onClose} className={clsx(
                      "group relative flex min-h-[62px] min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[.985]",
                      active ? "border-accent/25 bg-accent/10 text-accent shadow-[0_8px_24px_rgb(61_95_217_/_0.08)]" : "border-border bg-bg text-text hover:border-accent/20"
                    )}>
                      <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", active ? "bg-accent/10" : "bg-surface text-textMuted group-hover:text-accent")}><Icon size={17}/></span>
                      <span className="min-w-0 flex-1"><span className="block break-words text-2xs font-semibold leading-tight">{t(item.i18nKey)}</span>{item.sub && <span className="mt-0.5 block text-2xs text-textMuted">{tr("di workspace induk")}</span>}</span>
                      <ArrowRight size={12} className="shrink-0 text-textMuted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
          {!groups.length && <div className="rounded-2xl border border-dashed border-border px-5 py-9 text-center"><Search size={24} className="mx-auto text-accent"/><p className="mt-2 text-sm font-semibold text-text">{tr("Fitur tidak ditemukan")}</p><p className="mt-1 text-2xs text-textMuted">{tr("Coba kata seperti Keuangan, Target, Rutinitas, atau Insights.")}</p></div>}
        </div>

        <button onClick={() => void logout()} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-danger/15 bg-danger/5 text-sm font-semibold text-danger transition active:scale-[.985]"><LogOut size={15}/> {" "}{tr("Keluar")}</button>
      </div>
    </Overlay>
  );
}
