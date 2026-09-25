"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign, FileText, Sparkles, Target, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui";
import { clsx } from "clsx";

type Item = { id:string; at:string; title:string; detail:string; kind:string; href:string };
const iconFor=(kind:string):LucideIcon=>({Tugas:CheckCircle2,Fokus:Timer,Keuangan:CircleDollarSign,Catatan:FileText,Agenda:CalendarDays,Target,Proyek:Target,Inbox:Sparkles,Rutinitas:Activity,Licia:Sparkles}[kind]||Activity);

export function ActivityFeed({ limit=8 }:{limit?:number}){
  const [items,setItems]=useState<Item[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{fetch(`/api/activity?limit=${limit}`,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>setItems(d?.activities||[])).catch(()=>{}).finally(()=>setLoading(false));},[limit]);
  return <Card className="overflow-hidden">
    <SectionTitle action={<Link href="/timeline" className="inline-flex items-center gap-1 text-xs font-semibold text-accent">Lihat linimasa <ArrowRight size={12}/></Link>}>Aktivitas terbaru</SectionTitle>
    {loading ? <div className="space-y-2"><div className="h-12 animate-pulse rounded-xl bg-bg"/><div className="h-12 animate-pulse rounded-xl bg-bg"/><div className="h-12 animate-pulse rounded-xl bg-bg"/></div> : !items.length ? <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-textMuted">Belum ada aktivitas untuk ditampilkan.</div> : <div className="relative space-y-2"><div className="absolute bottom-4 left-[17px] top-4 w-px bg-border" aria-hidden="true"/>{items.map((item,index)=>{const Icon=iconFor(item.kind); return <Link href={item.href} key={item.id} className={clsx("relative flex items-start gap-3 rounded-xl p-2.5 licia-refined-hover",index<4&&"animate-licia-slide-in")} style={{animationDelay:`${index*55}ms`}}><span className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent"><Icon size={13}/></span><span className="min-w-0 flex-1"><span className="block break-words text-xs font-semibold text-text">{item.title}</span><span className="mt-0.5 block text-[10px] text-textMuted">{item.kind} · {new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(item.at))}</span><span className="mt-0.5 block break-words text-[10px] text-textMuted">{item.detail}</span></span></Link>})}</div>}
  </Card>;
}
