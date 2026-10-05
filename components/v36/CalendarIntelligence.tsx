"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

export function CalendarIntelligence(){
  const { tr } = useLanguage();
  const [data,setData]=useState<any>(null);
  useEffect(()=>{fetch("/api/v36/copilot",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setData).catch(()=>null)},[]);
  if(!data) return null;
  const conflicts=data.calendarConflicts||[]; const free=data.freeWindows||[]; const stats=data.stats||{};
  return <Card className="border-accent/15 bg-accent/5 p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><CalendarClock size={18}/></span><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-accent">{tr("Calendar Intelligence")}</p><h2 className="mt-1 text-base font-semibold text-text">{tr("Jadwal dipahami sebagai beban nyata")}</h2><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Licia mendeteksi benturan dan mencari ruang fokus yang cukup panjang.")}</p></div></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3"><Metric icon={TriangleAlert} value={conflicts.length} label="konflik"/><Metric icon={Clock3} value={`${Math.round(Number(stats.agendaMinutes||0)/60)}j`} label={tr("agenda 7 hari")}/><Metric icon={CheckCircle2} value={free[0]?`${free[0].minutes}m`:`—`} label={tr("ruang fokus terbesar")}/></div>
    {conflicts.length>0&&<div className="mt-3 space-y-2">{conflicts.slice(0,3).map((c:any)=><Link key={c.id} href="/calendar" className="block rounded-xl border border-danger/15 bg-danger/5 p-3"><p className="text-xs font-semibold text-text">{c.date}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{c.detail}</p></Link>)}</div>}
    {!conflicts.length&&<p className="mt-3 rounded-xl bg-success/5 p-3 text-[10px] text-textMuted">{tr("Tidak ada benturan terdeteksi pada 7 hari ke depan.")}</p>}
    {free.length>0&&<div className="mt-3 rounded-xl bg-bg p-3"><p className="text-[9px] font-semibold uppercase tracking-wider text-textMuted">{tr("Ruang fokus berikutnya")}</p><p className="mt-1 text-xs font-semibold text-text">{free[0].date} · {free[0].start}–{free[0].end}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Cukup untuk sesi sekitar")} {free[0].minutes} {tr("menit.")}</p></div>}
  </Card>
}
function Metric({icon:Icon,value,label}:{icon:any;value:any;label:string}){return <div className="rounded-xl bg-surface p-3"><Icon size={13} className="text-accent"/><p className="mt-1 text-lg font-semibold text-text">{value}</p><p className="text-[9px] text-textMuted">{label}</p></div>}
