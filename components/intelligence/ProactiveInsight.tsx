"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { useLanguage } from "@/components/LanguageProvider";

type Suggestion = { id: string; title: string; message: string; href: string; tone: "warning" | "info" | "success"; action?: string };

export function ProactiveInsight() {
  const { tr } = useLanguage();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/proactive/evaluate", { cache: "no-store", credentials: "include" });
        const data = await response.json().catch(() => ({}));
        if (!cancelled) setItems(Array.isArray(data?.suggestions) ? data.suggestions : []);
      } catch {} finally { if (!cancelled) setLoading(false); }
    };
    void load();
    const onSync = () => void load();
    window.addEventListener("licia:sync-complete", onSync);
    return () => { cancelled = true; window.removeEventListener("licia:sync-complete", onSync); };
  }, []);

  if (!loading && !items.length) return null;
  return <section className="licia-v32-page-in rounded-[1.5rem] border border-accent/15 bg-accent/5 p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="licia-v32-sync-pulse flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Sparkles size={16}/></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-accent">{tr("Licia menyarankan")}</p><h2 className="mt-1 font-display text-lg text-text">{tr("Hal yang patut kamu perhatikan")}</h2><p className="mt-1 text-[10px] text-textMuted">{tr("Saran ini berasal dari data Life OS yang sedang tersedia, bukan tebakan.")}</p></div></div>
    {loading ? <div className="mt-4 grid gap-2 sm:grid-cols-3">{[1,2,3].map((n)=><div key={n} className="licia-v32-skeleton h-24 rounded-2xl"/>)}</div> : <div className="mt-4 grid gap-2 sm:grid-cols-3">{items.map((item) => <Link href={item.href} key={item.id} className={clsx("licia-v32-interactive rounded-2xl border bg-surface p-3", item.tone === "warning" ? "border-warning/20" : item.tone === "success" ? "border-success/20" : "border-border")}><p className="text-xs font-semibold text-text">{item.title}</p><p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-textMuted">{item.message}</p><span className="mt-3 inline-flex items-center gap-1 text-[9px] font-semibold text-accent">{item.action || tr("Buka")}<ArrowRight size={10}/></span></Link>)}</div>}
  </section>;
}
