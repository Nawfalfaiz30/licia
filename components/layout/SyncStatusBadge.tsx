"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { countOfflineActions } from "@/lib/pwa/offlineQueue";
import { clsx } from "clsx";
import { useLanguage } from "@/components/LanguageProvider";
export function SyncStatusBadge() {
  const { t } = useLanguage();
  const [online,setOnline]=useState(true); const [queued,setQueued]=useState(0); const [conflicts,setConflicts]=useState(0); const [syncing,setSyncing]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    const refresh=async()=>{ if(cancelled)return; setOnline(navigator.onLine); setQueued(await countOfflineActions().catch(()=>0)); try{ const r=await fetch("/api/sync/status",{cache:"no-store"}); if(r.ok){const d=await r.json(); if(!cancelled)setConflicts(Number(d?.openConflicts||0));}}catch{} };
    const onStatus=(event:Event)=>{const state=(event as CustomEvent<{state?:string}>).detail?.state; setSyncing(state==="syncing"); if(state==="offline")setOnline(false); if(state==="online")setOnline(true); void refresh();};
    const onQueue=()=>void refresh(); void refresh(); const timer=window.setInterval(()=>void refresh(),30000);
    window.addEventListener("online",onQueue); window.addEventListener("offline",onQueue); window.addEventListener("licia:sync-status",onStatus); window.addEventListener("licia:offline-queue-change",onQueue); window.addEventListener("licia:sync-conflict",onQueue);
    return()=>{cancelled=true; window.clearInterval(timer); window.removeEventListener("online",onQueue); window.removeEventListener("offline",onQueue); window.removeEventListener("licia:sync-status",onStatus); window.removeEventListener("licia:offline-queue-change",onQueue); window.removeEventListener("licia:sync-conflict",onQueue);};
  },[]);
  const kind=!online||conflicts>0?"danger":queued>0||syncing?"syncing":"ok";
  const label=syncing?t("Menyinkronkan"):!online?t("Offline"):conflicts>0?t("{n} konflik",{n:conflicts}):queued>0?t("{n} perubahan menunggu",{n:queued}):t("Tersinkron · baru saja");
  const Icon=kind==="danger"?(online?AlertTriangle:CloudOff):kind==="syncing"?RefreshCw:Cloud;
  return <Link href="/sync" aria-label={label} title={label}
    className={clsx("flex h-9 w-9 items-center justify-center rounded-xl border transition-colors duration-150",
      kind==="danger"&&"border-danger/20 bg-danger/5 text-danger",kind==="syncing"&&"border-accent/20 bg-accent/5 text-accent",kind==="ok"&&"border-success/20 bg-success/5 text-success")}>
    <Icon size={15} className={kind==="syncing"?"animate-spin":""} aria-hidden="true" /></Link>;
}