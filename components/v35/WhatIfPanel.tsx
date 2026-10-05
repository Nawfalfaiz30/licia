"use client";
import { useState } from "react";
import { GitBranch, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";
export function WhatIfPanel(){
  const { tr } = useLanguage();
 const [days,setDays]=useState(1); const [busy,setBusy]=useState(false); const [result,setResult]=useState<any>(null);
 async function run(){setBusy(true);try{const r=await fetch('/api/v35/what-if',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({title:tr("Simulasi pergeseran {0} hari", [days]),shiftDays:days})});const j=await r.json();setResult(j?.ok?j:null)}finally{setBusy(false)}}
 return <Card className="border-accent/15"><div className="flex items-start gap-3"><div className="rounded-xl bg-accent/10 p-2.5 text-accent"><GitBranch size={16}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">{tr("Simulasi What-if")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Uji perubahan tanpa menyentuh kalender asli. Cocok untuk melihat dampak penundaan sebelum benar-benar menerapkannya.")}</p><div className="mt-3 flex flex-wrap gap-2"><select value={days} onChange={e=>setDays(Number(e.target.value))} className="rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text"><option value={1}>{tr("Geser 1 hari")}</option><option value={2}>{tr("Geser 2 hari")}</option><option value={3}>{tr("Geser 3 hari")}</option><option value={7}>{tr("Geser 7 hari")}</option></select><button onClick={()=>void run()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy?<Loader2 size={13} className="animate-spin"/>:<Sparkles size={13}/>} {tr("Simulasikan")}</button></div>{result&&<div className="mt-3 rounded-xl bg-bg p-3 text-[10px] text-textMuted"><p className="font-semibold text-text">{result.summary||tr("Simulasi selesai.")}</p>{Array.isArray(result.risks)&&result.risks.slice(0,3).map((x:any)=><p key={x} className="mt-1">• {x}</p>)}</div>}</div></div></Card>
}
