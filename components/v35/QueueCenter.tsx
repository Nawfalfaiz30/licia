"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { countOfflineActions, listOfflineConflicts, requestBackgroundSync } from "@/lib/pwa/offlineQueue";
import { Card } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";
export function QueueCenter(){
  const { tr } = useLanguage();
 const [queue,setQueue]=useState(0); const [conflicts,setConflicts]=useState(0); const [busy,setBusy]=useState(false);
 const load=async()=>{setQueue(await countOfflineActions().catch(()=>0));setConflicts((await listOfflineConflicts().catch(()=>[])).length)};
 useEffect(()=>{void load();const h=()=>void load();window.addEventListener('licia:offline-queue-change',h);window.addEventListener('licia:sync-conflict',h);return()=>{window.removeEventListener('licia:offline-queue-change',h);window.removeEventListener('licia:sync-conflict',h)}},[]);
 async function syncNow(){setBusy(true);try{await requestBackgroundSync();window.dispatchEvent(new CustomEvent('licia:sync-request'));}finally{setTimeout(()=>{void load();setBusy(false)},900)}}
 return <Card className="border-border bg-bg"><div className="flex items-center gap-2"><CloudOff size={15} className="text-accent"/><p className="text-xs font-semibold text-text">{tr("Antrean & pemulihan")}</p></div><div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]"><span className="rounded-full bg-surface px-2 py-1 text-textMuted">{queue} {tr("perubahan menunggu")}</span>{conflicts>0&&<span className="rounded-full bg-danger/10 px-2 py-1 text-danger"><AlertTriangle size={11} className="mr-1 inline"/>{conflicts} {tr("konflik lokal")}</span>}<button onClick={()=>void syncNow()} disabled={busy} className="ml-auto inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-2.5 py-1.5 font-semibold text-textMuted hover:text-accent disabled:opacity-50"><RefreshCw size={11} className={busy?'animate-spin':''}/> {tr("Sinkronkan")}</button></div></Card>
}
