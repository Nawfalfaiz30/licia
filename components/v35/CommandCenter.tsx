"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckSquare, Command, Home, MessageCircle, Search, Sparkles, Timer, X, Zap } from "lucide-react";

const ITEMS = [
  ["Beranda", "/dashboard", Home], ["Rencana", "/plan", CalendarDays], ["Tugas", "/tasks", CheckSquare], ["Kalender", "/calendar", CalendarDays], ["Fokus", "/focus", Timer], ["Chat Licia", "/chat", MessageCircle], ["Tangkap", "/capture", Zap], ["Target & Proyek", "/goals-projects", Sparkles], ["Knowledge & Belajar", "/knowledge", Sparkles], ["Keuangan", "/finance", Sparkles], ["Kesehatan & Rutinitas", "/wellbeing", Sparkles], ["Insights", "/insights", Sparkles], ["Pencarian", "/search", Search], ["Panduan", "/guide", Sparkles], ["Pengaturan", "/settings", Sparkles],
] as const;

export function CommandCenter() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); } if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const filtered = useMemo(() => ITEMS.filter(([label, href]) => `${label} ${href}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  return <>
    <button onClick={() => setOpen(true)} className="fixed right-20 top-3 z-[90] hidden min-h-9 items-center gap-2 rounded-xl border border-border bg-surface/90 px-2.5 text-[10px] font-semibold text-textMuted shadow-sm backdrop-blur md:flex" aria-label="Buka pusat perintah"><Command size={13}/><span>Ctrl K</span></button>
    {open && <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/45 p-3 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-2xl animate-licia-sheet-in">
        <div className="flex items-center gap-2 border-b border-border p-3"><Search size={17} className="text-textMuted"/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari halaman atau aksi…" className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none"/><button onClick={()=>setOpen(false)} className="rounded-xl p-2 text-textMuted hover:text-text"><X size={16}/></button></div>
        <div className="max-h-[55vh] overflow-y-auto p-2">{filtered.map(([label, href, Icon])=><Link key={href} href={href} onClick={()=>setOpen(false)} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-bg"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Icon size={15}/></span><span className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">{label}</p><p className="text-[9px] text-textMuted">{href}</p></span><ArrowRight size={13} className="text-textMuted"/></Link>)}{!filtered.length && <div className="p-8 text-center text-xs text-textMuted">Tidak ada perintah yang cocok.</div>}</div>
        <div className="border-t border-border px-3 py-2 text-[9px] text-textMuted">Esc menutup · Enter membuka hasil teratas · Gunakan Chat Licia untuk instruksi bahasa natural.</div>
      </div>
    </div>}
  </>;
}
