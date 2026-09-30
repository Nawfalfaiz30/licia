"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui";

type Status={displayName:boolean; goal:boolean; project:boolean; task:boolean; finance:boolean; habit:boolean};
export function OnboardingNudge(){
  const [data,setData]=useState<Status|null>(null); const [hidden,setHidden]=useState(false);
  useEffect(()=>{try{setHidden(localStorage.getItem("licia-onboarding-dismissed")==="true")}catch{}; fetch("/api/onboarding",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>setData(d?.status||null)).catch(()=>{});},[]);
  if(hidden||!data) return null;
  const completed=Object.values(data).filter(Boolean).length;
  if(completed>=4) return null;
  return <Card className="border-accent/20 bg-gradient-to-br from-accent/8 via-surface to-surface animate-licia-pop-in"><div className="flex items-start gap-3"><div className="rounded-xl bg-accent/10 p-2.5 text-accent"><Sparkles size={17}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-text">Siapkan Licia dalam beberapa langkah</p><p className="mt-1 text-xs leading-relaxed text-textMuted">Mulai dari sedikit data agar kecerdasan harian dan saran otomatis terasa lebih relevan.</p></div><button className="shrink-0 rounded-lg p-1 text-textMuted hover:bg-bg" onClick={()=>{setHidden(true);try{localStorage.setItem("licia-onboarding-dismissed","true")}catch{}}} aria-label="Tutup"><X size={14}/></button></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{[{ok:data.displayName,label:"Atur nama panggilan",href:"/settings"},{ok:data.goal,label:"Buat target",href:"/goals"},{ok:data.project,label:"Buat proyek",href:"/projects"},{ok:data.task,label:"Tambahkan tugas",href:"/tasks"},{ok:data.finance,label:"Catat transaksi",href:"/finance"},{ok:data.habit,label:"Buat rutinitas",href:"/habits"}].slice(0,4).map(x=><Link key={x.label} href={x.href} className="flex items-center gap-2 rounded-xl border border-border bg-surface/75 p-2.5 text-xs font-semibold text-text transition hover:-translate-y-0.5 hover:border-accent/30">{x.ok?<CheckCircle2 size={14} className="text-success"/>:<span className="h-3.5 w-3.5 rounded-full border border-border"/>}<span className="min-w-0 flex-1">{x.label}</span><ArrowRight size={12} className="text-textMuted"/></Link>)}</div></div></div></Card>
}
