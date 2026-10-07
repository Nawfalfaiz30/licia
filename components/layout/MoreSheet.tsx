"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Grid2X2, LogOut, Search, X } from "lucide-react";
import { moreNavGroups, isNavPathActive } from "./nav-items";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { Overlay } from "@/components/ui/Overlay";

export function MoreSheet({open,onClose}:{open:boolean;onClose:()=>void}){
  const {t}=useLanguage(); const pathname=usePathname(); const router=useRouter(); const [query,setQuery]=useState(""); const supabase=createClient(); const q=query.trim().toLowerCase();
  const items=useMemo(()=>moreNavGroups.flatMap(g=>g.items).filter(i=>!q||(`${i.label} ${t(i.i18nKey)}`).toLowerCase().includes(q)).filter((i,idx,arr)=>arr.findIndex(x=>x.href===i.href)===idx),[q,t]);
  async function logout(){await supabase.auth.signOut();onClose();router.replace("/login");router.refresh();}
  return <Overlay open={open} onClose={onClose} tier="sheet" align="bottom" flush visibilityClassName="md:hidden" label={t("Lainnya")} panelClassName="w-full">
    <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.5rem] border-t border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
      <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-border"/>
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Grid2X2 size={18}/></span>
        <div className="min-w-0 flex-1"><p className="font-display text-lg text-text">{t("Lainnya")}</p><p className="text-2xs text-textMuted">{t("Fitur lain dalam satu tempat.")}</p></div>
        <button type="button" onClick={onClose} className="touch-target rounded-xl border border-border bg-bg text-textMuted" aria-label={t("Tutup")}><X size={18}/></button></div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-bg px-3"><Search size={15} className="shrink-0 text-textMuted"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("Cari fitur…")} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-textMuted" aria-label={t("Cari fitur")}/>
        {query&&<button type="button" onClick={()=>setQuery("")} className="rounded-lg px-2 py-1 text-2xs font-semibold text-textMuted">{t("Hapus")}</button>}</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {items.map(item=>{const active=isNavPathActive(pathname,item.href);const Icon=item.icon;return <Link key={item.href} href={item.href} onClick={onClose}
          className={clsx("flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors duration-150 active:scale-[.985]",
            active?"border-accent/25 bg-accent/10 text-accent":"border-border bg-bg text-text hover:border-accent/20")}>
          <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl",active?"bg-accent/10":"bg-surface text-textMuted")}><Icon size={17} aria-hidden="true"/></span>
          <span className="line-clamp-2 text-2xs font-semibold leading-tight">{t(item.i18nKey)}</span></Link>})}
      </div>
      {!items.length&&<div className="rounded-2xl border border-dashed border-border px-5 py-9 text-center text-xs text-textMuted">{t("Fitur tidak ditemukan")}</div>}
      <button type="button" onClick={()=>void logout()} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-danger/15 bg-danger/5 text-sm font-semibold text-danger"><LogOut size={15} aria-hidden="true"/> {t("Keluar")}</button>
    </div>
  </Overlay>;
}