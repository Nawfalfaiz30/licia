"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, BrainCircuit, CalendarDays, CheckCircle2, CircleDollarSign, Sparkles, Target, Timer, Zap } from "lucide-react";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { clsx } from "clsx";

type Payload = {
  date: string;
  stats: { openTasks:number; overdueTasks:number; todayAgenda:number; inboxOpen:number; focusMinutes:number; monthIncome:number; monthExpense:number; monthNet:number; projectsActive:number; staleProjects:number; goalsActive:number; habitsChecked:number };
  nextActions: Array<{id:string;title:string;priority:string;dueAt:string|null;href:string}>;
  suggestions: Array<{id:string;title:string;detail:string;href:string;action:string;tone:string}>;
  notifications: Array<{id:string;title:string;detail:string;href:string;tone:string}>;
  focusMessage: string;
};

function rupiah(n:number){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n)}
function dueLabel(v:string|null){if(!v)return "Tanpa tenggat";return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(v));}

export function DailyIntelligence({ compact = false }: { compact?: boolean }) {
  const [data,setData]=useState<Payload|null>(null);
  const [loading,setLoading]=useState(true);
  const [noticePermission,setNoticePermission]=useState<NotificationPermission|"unsupported">("unsupported");
  const [enabled,setEnabled]=useState(true);
  const [suggestionsEnabled,setSuggestionsEnabled]=useState(true);
  const lastLoadedAt=useRef(0);

  async function load(force=false){
    const nowMs=Date.now();
    if(!force && nowMs-lastLoadedAt.current<60_000) return;
    try {
      let leadDays=7; try { const raw=Number(localStorage.getItem("licia-notification-lead-days")); if([1,3,7,14].includes(raw)) leadDays=raw; } catch {}
      const res=await fetch(`/api/intelligence?now=${encodeURIComponent(new Date().toISOString())}&leadDays=${leadDays}`,{cache:"no-store"});
      if(res.ok){setData(await res.json()); lastLoadedAt.current=nowMs;}
    } catch {} finally { setLoading(false); }
  }
  useEffect(()=>{
    try { setEnabled(localStorage.getItem("licia-show-daily-intelligence") !== "false"); setSuggestionsEnabled(localStorage.getItem("licia-smart-suggestions") !== "false"); } catch {}
    void load(true);
    if("Notification" in window)setNoticePermission(Notification.permission);
    const onPrefs=()=>{try{setEnabled(localStorage.getItem("licia-show-daily-intelligence") !== "false"); setSuggestionsEnabled(localStorage.getItem("licia-smart-suggestions") !== "false")}catch{}; void load(true);};
    const onFocus=()=>void load();
    const onVisibility=()=>{if(document.visibilityState==="visible") void load();};
    window.addEventListener("licia:preferences-change",onPrefs);
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{window.removeEventListener("licia:preferences-change",onPrefs);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisibility)};
  },[]);

  async function enableNotifications(){
    if(!("Notification" in window))return;
    const p=await Notification.requestPermission();
    setNoticePermission(p);
    if(p==="granted" && data?.notifications[0]) new Notification(data.notifications[0].title,{body:data.notifications[0].detail});
  }

  const toneClasses=useMemo(()=>({danger:"border-danger/20 bg-danger/5",accent:"border-accent/20 bg-accent/5",accentSoft:"border-accentSoft/20 bg-accentSoft/5",success:"border-success/20 bg-success/5"}),[]);
  if(!enabled) return null;
  if(loading && !data)return <Card className="overflow-hidden"><div className="h-24 animate-licia-shimmer rounded-xl bg-bg/70"/></Card>;
  if(!data)return null;
  return <div className={clsx("space-y-4",compact?"":"animate-licia-in")}>
    <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent/8 via-surface to-surface">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent/10 blur-2xl animate-licia-float" />
      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent"><Sparkles size={13}/> Kecerdasan Harian</p><h2 className="mt-1 font-display text-2xl text-text">Apa yang penting sekarang?</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-textMuted">Licia membaca keadaan tugas, agenda, proyek, target, fokus, Inbox, dan keuangan untuk memberi langkah berikutnya.</p></div>
          <div className="flex items-center gap-2"><span className="rounded-full border border-border bg-bg px-3 py-1.5 text-[10px] text-textMuted">{data.date}</span>{noticePermission!=="unsupported"&&<button onClick={enableNotifications} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"><BellRing size={13} className="mr-1.5 inline"/>{noticePermission==="granted"?"Notifikasi aktif":"Aktifkan notifikasi"}</button>}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Tugas terbuka" value={String(data.stats.openTasks)} icon={CheckCircle2} tone="accent" hint={data.stats.overdueTasks?`${data.stats.overdueTasks} terlambat`:"Tidak ada yang terlambat"}/>
          <StatTile label="Agenda hari ini" value={String(data.stats.todayAgenda)} icon={CalendarDays} tone="default" hint={data.stats.inboxOpen?`${data.stats.inboxOpen} Inbox terbuka`:"Inbox bersih"}/>
          <StatTile label="Fokus minggu ini" value={`${data.stats.focusMinutes} m`} icon={Timer} tone="success" hint={data.focusMessage}/>
          <StatTile label="Arus bulan ini" value={rupiah(data.stats.monthNet)} icon={CircleDollarSign} tone={data.stats.monthNet<0?"danger":"default"} hint={`${rupiah(data.stats.monthExpense)} keluar`}/>
        </div>
      </div>
    </Card>

    <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      {suggestionsEnabled && <Card>
        <SectionTitle action={<Link href="/chat" className="text-xs font-semibold text-accent hover:opacity-80">Tanya Licia <ArrowRight size={13} className="ml-1 inline"/></Link>}>Saran paling relevan</SectionTitle>
        <div className="space-y-2.5">
          {data.suggestions.slice(0,4).map((s)=><Link key={s.id} href={s.href} className={clsx("group block rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm",toneClasses[s.tone as keyof typeof toneClasses]||toneClasses.accent)}><div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-surface/70 p-2 text-accent"><BrainCircuit size={15}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">{s.title}</p><p className="mt-1 text-xs leading-relaxed text-textMuted">{s.detail}</p><span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">{s.action}<ArrowRight size={11} className="transition group-hover:translate-x-0.5"/></span></div></div></Link>)}
          {!data.suggestions.length&&<p className="rounded-xl bg-bg p-4 text-sm text-textMuted">Tidak ada sinyal mendesak. Hari ini terlihat cukup tertata.</p>}
        </div>
      </Card>}
      <Card>
        <SectionTitle>Langkah berikutnya</SectionTitle>
        <div className="space-y-2">
          {data.nextActions.slice(0,5).map((t)=><Link href={t.href} key={t.id} className="flex items-center gap-3 rounded-xl bg-bg p-3 transition hover:-translate-y-0.5 hover:bg-accent/5"><div className="rounded-lg bg-surface p-2 text-accent"><Zap size={14}/></div><div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold text-text">{t.title}</p><p className="mt-1 text-[10px] text-textMuted">{t.priority} · {dueLabel(t.dueAt)}</p></div></Link>)}
          {!data.nextActions.length&&<p className="text-sm text-textMuted">Belum ada tindakan yang menunggu.</p>}
        </div>
      </Card>
    </div>

    {data.notifications.length>0&&<Card className="border-accent/15 bg-accent/5"><SectionTitle action={<Link href="/automations" className="text-xs font-semibold text-accent">Aturan otomatis <ArrowRight size={12} className="ml-1 inline"/></Link>}>Yang perlu diperhatikan</SectionTitle><div className="grid gap-2 sm:grid-cols-2">{data.notifications.slice(0,4).map(n=><Link key={n.id} href={n.href} className="flex items-start gap-2 rounded-xl bg-surface/70 p-3"><Target size={14} className="mt-0.5 shrink-0 text-accent"/><div className="min-w-0"><p className="text-xs font-semibold text-text">{n.title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-textMuted">{n.detail}</p></div></Link>)}</div></Card>}
  </div>;
}
