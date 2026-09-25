"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, ArrowRight, Bell, CheckSquare, FolderKanban, Target, StickyNote, Inbox,
  Sparkles, CalendarDays, BarChart3, BrainCircuit, Vault, Zap, BookOpen,
  GraduationCap, HeartPulse, Wallet, ListChecks, Clock3, X, Command, Activity,
  Settings, Timer, PanelTop, History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Result = { id:string; type:string; title:string; detail?:string; href:string };
const typeIcon:Record<string,LucideIcon> = {
  Tugas:CheckSquare, Proyek:FolderKanban, Target, Catatan:StickyNote, Inbox,
  Kalender:CalendarDays, Keuangan:Wallet, Kesehatan:HeartPulse, Analitik:BarChart3,
  Memori:BrainCircuit, Vault, Otomatisasi:Zap, Bacaan:BookOpen, Pembelajaran:GraduationCap,
  Keputusan:ListChecks, Fokus:Clock3,
};
type Shortcut = readonly [string, string, string, LucideIcon];
const shortcuts:readonly Shortcut[] = [
  ["/today","Hari Ini","Ruang utama hari ini",Sparkles],
  ["/tasks","Tugas","Pekerjaan yang perlu selesai",CheckSquare],
  ["/calendar","Kalender","Agenda dan jadwal",CalendarDays],
  ["/inbox","Smart Inbox","Tangkap dan pilah",Inbox],
  ["/notes","Catatan","Simpan pengetahuan",StickyNote],
  ["/projects","Proyek","Pekerjaan yang sedang berjalan",FolderKanban],
  ["/goals","Target","Arah dan milestone",Target],
  ["/focus","Fokus","Mulai sesi fokus",Timer],
  ["/finance","Keuangan","Saldo dan transaksi",Wallet],
  ["/health","Kesehatan","Check-in dan log",HeartPulse],
  ["/analytics","Analitik","Pola aktivitas",BarChart3],
  ["/timeline","Linimasa","Jejak lintas modul",History],
  ["/ai-history","AI Action Log","Jejak aksi & undo",History],
  ["/reminders","Pengingat","Atur reminder dan alarm",Bell],
  ["/system","System Center","Status aplikasi dan integrasi",Activity],
  ["/review","Weekly Review","Tinjau ritme mingguan",Sparkles],
  ["/automations","Otomatisasi","Aturan proaktif",Zap],
  ["/memory","Memori","Konteks yang diingat",BrainCircuit],
  ["/settings","Pengaturan","Kendalikan Licia",Settings],
  ["/command","Life Command","Jalankan perintah natural language",Command],
  ["/guide","Panduan","Pelajari seluruh fitur",PanelTop],
  ["/chat","Tanya Licia","Buka percakapan AI",Sparkles],
];

export function QuickSearch(){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const [results,setResults]=useState<Result[]>([]);
  const [loading,setLoading]=useState(false);
  const [mounted,setMounted]=useState(false);
  const [desktopPosition,setDesktopPosition]=useState<{top:number;right:number}|null>(null);
  const buttonRef=useRef<HTMLButtonElement>(null);
  const panelRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>setMounted(true),[]);

  function updatePosition(){
    if(!buttonRef.current) return;
    const r=buttonRef.current.getBoundingClientRect();
    setDesktopPosition({top:r.bottom+10,right:Math.max(12,window.innerWidth-r.right)});
  }

  useEffect(()=>{
    if(!open) return;
    updatePosition();
    const onResize=()=>updatePosition();
    function onPointer(e:PointerEvent){
      const target=e.target as Node;
      if(buttonRef.current?.contains(target)||panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onShortcut(e:KeyboardEvent){
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(()=>inputRef.current?.focus());
      }
      if(e.key==="Escape") setOpen(false);
    }
    window.addEventListener("resize",onResize);
    document.addEventListener("pointerdown",onPointer,true);
    document.addEventListener("keydown",onShortcut);
    requestAnimationFrame(()=>inputRef.current?.focus());
    return()=>{
      window.removeEventListener("resize",onResize);
      document.removeEventListener("pointerdown",onPointer,true);
      document.removeEventListener("keydown",onShortcut);
    };
  },[open]);


  useEffect(()=>{
    const trimmed=q.trim();
    if(!open||trimmed.length<2||trimmed.startsWith(">")){
      setResults([]);setLoading(false);return;
    }
    const controller=new AbortController();
    const id=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const r=await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`,{cache:"no-store",signal:controller.signal});
        const data=await r.json().catch(()=>({}));
        setResults(Array.isArray(data.results)?data.results.slice(0,10):[]);
      }catch(error){
        if(error instanceof DOMException&&error.name==="AbortError") return;
      }finally{setLoading(false);}
    },160);
    return()=>{window.clearTimeout(id);controller.abort();};
  },[q,open]);

  const query=q.trim().replace(/^>/,"").trim().toLowerCase();
  const commandShortcuts=useMemo(()=>shortcuts.filter(([,label,detail])=>!query||label.toLowerCase().includes(query)||detail.toLowerCase().includes(query)),[query]);

  function close(){setOpen(false);setQ("");}

  function submit(){
    const term=q.trim();
    if(!term) return;
    if(term.startsWith(">")){
      const first=commandShortcuts[0];
      if(first){window.location.href=first[0];close();}
      return;
    }
    window.location.href=`/search?q=${encodeURIComponent(term)}`;
    close();
  }

  const panel= open ? (
    <>
      <button type="button" aria-label="Tutup pencarian" onClick={close} className="quick-search-backdrop-v27 fixed inset-0 z-[9998] hidden bg-black/15 backdrop-blur-[1px] md:hidden" />
      <div
      ref={panelRef}
      className="quick-search-panel-v26 animate-licia-pop-in"
      style={desktopPosition ? {top:desktopPosition.top,right:desktopPosition.right}:undefined}
      role="dialog"
      aria-label="Pencarian cepat Licia"
    >
      <div className="flex items-center gap-2 border-b border-border p-2.5 sm:p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-bg px-3">
          <Search size={15} className="shrink-0 text-textMuted"/>
          <input ref={inputRef} id="licia-quick-search-input" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit()}} placeholder="Cari data, modul, atau ketik >perintah…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-textMuted" autoComplete="off" />
        </div>
        <button onClick={close} className="quick-search-close touch-target flex shrink-0 items-center justify-center rounded-xl border border-border bg-bg text-textMuted hover:text-text" aria-label="Tutup pencarian"><X size={17}/></button>
      </div>

      <div className="quick-search-scroll-v26 min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 sm:p-3">
        {!q.trim() && <>
          <div className="quick-search-hero-v26 rounded-2xl border border-accent/15 bg-accent/5 p-3">
            <div className="flex items-start gap-2.5"><span className="rounded-xl bg-accent/10 p-2 text-accent"><Sparkles size={15}/></span><div className="min-w-0"><p className="text-xs font-semibold text-text">Cari apa saja di Life OS</p><p className="mt-0.5 text-[10px] leading-relaxed text-textMuted">Data pribadi, modul, atau perintah cepat. Panel ini selalu muat di layar HP.</p></div></div>
            <div className="mt-3 grid grid-cols-3 gap-1.5"><Link href="/capture" onClick={close} className="quick-search-chip-v26">Capture</Link><Link href="/chat" onClick={close} className="quick-search-chip-v26">Tanya Licia</Link><Link href="/command" onClick={close} className="quick-search-chip-v26">Life Command</Link></div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-textMuted">Akses cepat</p><p className="mt-0.5 text-[10px] text-textMuted">Modul yang paling sering dibuka.</p></div><Link href="/search" onClick={close} className="text-[10px] font-semibold text-accent">Lihat semua</Link></div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {shortcuts.slice(0,9).map(([href,label,detail,Icon])=><Link key={href} href={href} onClick={close} className="quick-search-tile-v26 group flex min-w-0 items-center gap-2 rounded-xl border border-border bg-bg/60 px-2.5 py-2.5 transition hover:-translate-y-0.5 hover:border-accent/35 hover:bg-accent/5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Icon size={14}/></span><span className="min-w-0"><span className="block truncate text-[10px] font-semibold text-text">{label}</span><span className="block truncate text-[9px] text-textMuted">{detail}</span></span></Link>)}
          </div>
          <div className="mt-3 rounded-2xl border border-border bg-bg/55 p-3"><div className="flex items-center gap-2"><Command size={13} className="text-accent"/><p className="text-[10px] font-semibold text-text">Perintah cepat</p></div><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Ketik <span className="font-semibold text-text">&gt;</span> lalu pilih modul. Contoh: <span className="font-semibold text-text">&gt; target</span>.</p></div>
        </>}

        {q.trim().startsWith(">") && <div><div className="flex items-center gap-2 px-1 py-1.5"><Command size={13} className="text-accent"/><p className="text-[11px] font-semibold text-text">Perintah cepat</p></div><div className="grid grid-cols-2 gap-1.5">{!commandShortcuts.length?<p className="col-span-2 rounded-xl border border-dashed border-border p-4 text-center text-[10px] text-textMuted">Tidak ada perintah yang cocok.</p>:commandShortcuts.slice(0,10).map(([href,label,detail,Icon])=><Link key={href} href={href} onClick={close} className="quick-search-tile-v26 flex min-w-0 items-center gap-2 rounded-xl border border-border bg-bg p-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Icon size={13}/></span><span className="min-w-0"><span className="block truncate text-[10px] font-semibold text-text">{label}</span><span className="block truncate text-[9px] text-textMuted">{detail}</span></span></Link>)}</div></div>}

        {loading&&<div className="p-8 text-center"><Sparkles size={16} className="mx-auto animate-pulse text-accent"/><p className="mt-2 text-xs text-textMuted">Mencari di seluruh Life OS…</p></div>}
        {!loading&&q.trim().length>=2&&!results.length&&!q.trim().startsWith(">")&&<div className="p-8 text-center"><Search size={18} className="mx-auto text-textMuted"/><p className="mt-2 text-xs font-semibold text-text">Tidak menemukan data</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Buka pencarian lengkap untuk pencocokan yang lebih luas.</p><button onClick={submit} className="mt-3 rounded-xl bg-accent px-3 py-2 text-[10px] font-semibold text-white">Buka pencarian</button></div>}
        {!loading&&results.length>0&&<div className="space-y-1">{results.map(r=>{const Icon=typeIcon[r.type]||Activity;return <Link key={`${r.type}-${r.id}`} href={r.href} onClick={close} className="group flex min-w-0 items-start gap-2.5 rounded-xl p-2.5 transition hover:bg-bg"><span className="rounded-lg bg-accent/10 p-2 text-accent"><Icon size={14}/></span><span className="min-w-0 flex-1"><span className="flex min-w-0 flex-wrap items-center gap-1.5"><span className="min-w-0 break-words text-xs font-semibold text-text">{r.title}</span><span className="rounded-full bg-bg px-1.5 py-0.5 text-[8px] font-semibold text-textMuted">{r.type}</span></span>{r.detail&&<span className="mt-0.5 block break-words text-[10px] text-textMuted">{r.detail}</span>}</span><ArrowRight size={13} className="mt-1 shrink-0 text-textMuted transition group-hover:translate-x-0.5 group-hover:text-accent"/></Link>})}</div>}
      </div>
      {q.trim()&&!loading&&<button onClick={submit} className="flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-2.5 text-[10px] font-semibold text-accent hover:bg-accent/5">Lihat semua hasil <ArrowRight size={11}/></button>}
      </div>
    </>
  ) : null;

  return <>
    <button ref={buttonRef} onClick={()=>{setOpen(v=>!v);updatePosition()}} className="quick-search-control touch-target flex items-center justify-center rounded-xl border border-border bg-surface text-textMuted shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent" aria-label="Cari seluruh Life OS" title="Cari seluruh Life OS"><Search size={17}/></button>
    {mounted&&open&&createPortal(panel,document.body)}
  </>;
}
