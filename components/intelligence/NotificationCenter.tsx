"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Check, CheckCircle2, ExternalLink, Info, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { subscribeToLiciaPush, getPushStatus, type PushClientState } from "@/lib/notifications/client";
import { notifyToast } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

type Notice = { id:string; title:string; body:string|null; href:string; tone:string; read_at:string|null; delivered_at:string|null; created_at:string };

function toneIcon(tone:string):LucideIcon {
  if (tone === "danger") return AlertTriangle;
  if (tone === "success") return CheckCircle2;
  if (tone === "warning" || tone === "attention") return AlertTriangle;
  if (tone === "info") return Info;
  return Sparkles;
}
function toneClass(tone:string) {
  if (tone === "danger") return "bg-danger/10 text-danger";
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "warning" || tone === "attention") return "bg-accentSoft/10 text-accentSoft";
  return "bg-accent/10 text-accent";
}
function displayTitle(row:Notice) {
  return row.title.replace(/^Pengingat:\s*/i, "");
}
function displayBody(row:Notice) {
  if (row.body?.trim()) return row.body;
  return row.title.toLowerCase().startsWith("pengingat") ? "Pengingat Licia yang perlu diperhatikan." : "Tidak ada detail tambahan.";
}

async function showBrowserNotice(row:Notice) {
  const options: NotificationOptions = { body: displayBody(row), icon: "/icon-192.png", tag: `licia-${row.id}`, data: { href: row.href || "/" } };
  if ("serviceWorker" in navigator) {
    try { const registration = await navigator.serviceWorker.ready; await registration.showNotification(displayTitle(row), options); return; } catch {}
  }
  try { new Notification(displayTitle(row), options); } catch {}
}

export function NotificationCenter(){
  const { tr, locale } = useLanguage();
 const [open,setOpen]=useState(false); const [rows,setRows]=useState<Notice[]>([]); const [loading,setLoading]=useState(false); const [push,setPush]=useState<PushClientState>("permission"); const [deleting,setDeleting]=useState<string|null>(null);
 const lastLoaded=useRef(0); const knownIds=useRef<Set<string>>(new Set()); const notifiedIds=useRef<Set<string>>(new Set()); const initialized=useRef(false);
 async function dispatchAndLoad(force=false){
  const now=Date.now(); if(!force&&now-lastLoaded.current<15_000)return; setLoading(true);
  try {
    await Promise.all([
      fetch("/api/reminders/dispatch?mode=client",{cache:"no-store"}).catch(()=>null),
      fetch("/api/automations/evaluate",{cache:"no-store"}).catch(()=>null),
      fetch("/api/intelligence?mode=notifications",{cache:"no-store"}).catch(()=>null),
    ]);
    const res=await fetch("/api/notifications?limit=30",{cache:"no-store"});
    if(res.ok){
      const data=await res.json(); const next:Notice[]=Array.isArray(data.notifications)?data.notifications:[];
      const fresh=next.filter(item=>!knownIds.current.has(item.id)&&!item.read_at&&!item.delivered_at);
      setRows(next);
      try {
        const enabled=localStorage.getItem("licia-browser-notifications")==="true";
        if(enabled&&Notification.permission==="granted") {
          const candidates=initialized.current?fresh:next.filter(item=>!item.read_at&&!item.delivered_at&&Date.now()-new Date(item.created_at).getTime()<=90_000);
          const candidate=candidates.find(item=>!notifiedIds.current.has(item.id));
          if(candidate){await showBrowserNotice(candidate);notifiedIds.current.add(candidate.id);}
        }
      } catch {}
      if(!initialized.current) initialized.current=true;
      knownIds.current=new Set(next.map(item=>item.id)); lastLoaded.current=now;
    }
  } catch {} finally { setLoading(false); }
 }
 useEffect(()=>{void dispatchAndLoad(true);void getPushStatus().then(setPush);const onFocus=()=>void dispatchAndLoad();const onVisible=()=>{if(document.visibilityState==="visible")void dispatchAndLoad()};const onPush=()=>void getPushStatus().then(setPush);window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onVisible);window.addEventListener("licia:push-status-change",onPush);return()=>{window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("licia:push-status-change",onPush)}},[]);
 useEffect(()=>{if(open)void dispatchAndLoad(true)},[open]);
 useEffect(()=>{let timer:number|undefined;let interval=1;try{const raw=Number(localStorage.getItem("licia-notification-poll-minutes"));if([1,2,5,10].includes(raw))interval=raw}catch{}timer=window.setInterval(()=>void dispatchAndLoad(true),interval*60_000);return()=>{if(timer)window.clearInterval(timer)}},[]);
 useEffect(()=>{let timer:number|undefined;const reconnect=async()=>{try{if(localStorage.getItem("licia-push-auto-reconnect")!=="true"||!window.isSecureContext||!("Notification" in window)||Notification.permission!=="granted")return;const current=await getPushStatus();setPush(current);if(current==="unsubscribed"){const result=await subscribeToLiciaPush();setPush(result.state)}}catch{}};void reconnect();timer=window.setInterval(()=>void reconnect(),5*60_000);const onVisibility=()=>{if(document.visibilityState==="visible")void reconnect()};window.addEventListener("licia:preferences-change",reconnect);document.addEventListener("visibilitychange",onVisibility);return()=>{if(timer)window.clearInterval(timer);window.removeEventListener("licia:preferences-change",reconnect);document.removeEventListener("visibilitychange",onVisibility)}},[]);
 const unread=rows.filter(x=>!x.read_at).length;
 async function mark(id:string){setRows(x=>x.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}).catch(()=>null)}
 async function markAll(){setRows(x=>x.map(n=>({...n,read_at:n.read_at||new Date().toISOString()})));await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({all:true})}).catch(()=>null)}
 async function removeOne(id:string){if(deleting)return;setDeleting(id);const res=await fetch("/api/notifications",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}).catch(()=>null);const data=await res?.json().catch(()=>({}));if(!res?.ok||!data?.ok){notifyToast({title:tr("Notifikasi belum terhapus"),message:data?.error||tr("Coba lagi."),tone:"error"});setDeleting(null);return}setRows(v=>v.filter(x=>x.id!==id));notifyToast({title:tr("Notifikasi dihapus"),message:tr("Item ini dihapus dari riwayat."),tone:"success"});setDeleting(null)}
 async function clearAllHistory(){if(!rows.length)return notifyToast({title:tr("Riwayat notifikasi kosong"),message:tr("Tidak ada riwayat yang bisa dihapus."),tone:"info"});if(!window.confirm(tr("Hapus seluruh riwayat notifikasi? Saat ini {0} item sedang ditampilkan.", [rows.length])))return;const res=await fetch("/api/notifications",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({all:true})}).catch(()=>null);const data=await res?.json().catch(()=>({}));if(!res?.ok||!data?.ok)return notifyToast({title:tr("Riwayat belum terhapus"),message:data?.error||tr("Coba lagi."),tone:"error"});setRows([]);notifyToast({title:tr("Riwayat notifikasi dihapus"),message:tr("{0} notifikasi dihapus.", [data.deleted??0]),tone:"success"})}
 async function enablePush(){const result=await subscribeToLiciaPush({forceRenew:push==="error"});setPush(result.state);if(!result.ok)notifyToast({title:tr("Notifikasi belum aktif"),message:result.error||tr("Periksa izin browser."),tone:"error"});else notifyToast({title:tr("Notifikasi aktif"),message:tr("Licia dapat mengirim reminder ke perangkat ini."),tone:"success"})}
 return <div className="relative">
  <button onClick={()=>setOpen(v=>!v)} className="touch-target relative flex items-center justify-center rounded-xl border border-border bg-surface text-textMuted shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent" aria-label={tr("Pusat notifikasi")} title={tr("Notifikasi")}><Bell size={17}/>{unread>0&&<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-sm">{unread>9?"9+":unread}</span>}</button>
  {open&&<><button className="fixed inset-0 z-popover bg-black/35 backdrop-blur-[2px]" aria-label={tr("Tutup notifikasi")} onClick={()=>setOpen(false)}/><div className="licia-notification-panel fixed right-4 top-[calc(4.75rem+env(safe-area-inset-top))] z-popover isolate w-[min(calc(100vw-2rem),430px)] overflow-hidden rounded-2xl border border-border shadow-2xl animate-licia-pop-in max-md:inset-x-2 max-md:right-auto max-md:w-auto max-md:top-[calc(4.25rem+env(safe-area-inset-top))]">
   <div className="border-b border-border bg-bg/80 px-4 py-3.5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-lg bg-accent/10 p-1.5 text-accent"><Bell size={13}/></span><p className="text-sm font-semibold text-text">{tr("Notifikasi")}</p>{unread>0&&<span className="rounded-full bg-danger/10 px-2 py-0.5 text-[9px] font-bold text-danger">{unread} {tr("baru")}</span>}</div><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Pengingat, hasil otomatisasi, dan sinyal AI yang penting untuk sekarang.")}</p></div><div className="flex flex-wrap items-center justify-end gap-1">{push!=="subscribed"&&push!=="unsupported"&&push!=="denied"&&<button type="button" onClick={()=>void enablePush()} className="min-w-[106px] shrink-0 whitespace-nowrap rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1.5 text-[10px] font-semibold text-accent">{push==="error"?tr("Perbaiki push"):tr("Aktifkan push")}</button>}<button type="button" onClick={()=>void markAll()} className="rounded-lg p-2 text-textMuted hover:bg-surface hover:text-accent" title={tr("Tandai semua dibaca")}><Check size={14}/></button><button type="button" onClick={()=>void clearAllHistory()} className="rounded-lg p-2 text-textMuted hover:bg-surface hover:text-danger" title={tr("Hapus semua riwayat notifikasi")}><Trash2 size={14}/></button><button type="button" onClick={()=>void dispatchAndLoad(true)} className="rounded-lg p-2 text-textMuted hover:bg-surface hover:text-accent" title={tr("Segarkan")}><RefreshCw size={14} className={loading?"animate-spin":""}/></button><button type="button" onClick={()=>setOpen(false)} className="rounded-lg p-2 text-textMuted hover:bg-surface hover:text-text" title={tr("Tutup")}><X size={14}/></button></div></div></div>
   <div className="max-h-[64vh] overflow-y-auto bg-surface p-2">{loading&&!rows.length?<div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"/><p className="text-xs text-textMuted">{tr("Memuat notifikasi…")}</p></div>:rows.length?rows.map(r=>{const Icon=toneIcon(r.tone);return <article key={r.id} className={clsx("mx-1 my-1 rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm",!r.read_at?"border-accent/15 bg-accent/[.055]":"border-border bg-bg/45")}><div className="flex gap-3"><div className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",toneClass(r.tone))}><Icon size={14}/></div><div className="min-w-0 flex-1"><Link href={r.href||"/"} onClick={()=>{void mark(r.id);setOpen(false)}} className="group block min-w-0"><div className="flex items-start justify-between gap-2"><p className="break-words text-xs font-semibold text-text">{displayTitle(r)}</p>{!r.read_at&&<span className="shrink-0 text-[9px] font-bold text-accent">{tr("Baru")}</span>}</div><p className="mt-1 break-words text-[11px] leading-relaxed text-textMuted">{tr(displayBody(r))}</p><p className="mt-2 text-[9px] text-textMuted">{new Date(r.created_at).toLocaleString(locale,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}{r.delivered_at?tr(" · push dikirim"):tr(" · tersimpan")}</p><span className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-accent">{tr("Buka")} <ExternalLink size={10}/></span></Link></div><button type="button" onClick={()=>void removeOne(r.id)} disabled={deleting!==null} className="touch-target shrink-0 self-start rounded-lg text-textMuted hover:bg-danger/5 hover:text-danger disabled:opacity-50" aria-label={tr("Hapus notifikasi {0}", [displayTitle(r)])} title={tr("Hapus notifikasi")}>{deleting===r.id?<RefreshCw size={12} className="animate-spin"/>:<X size={13}/>}</button></div></article>}) : <div className="px-4 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Bell size={18}/></div><p className="mt-3 text-sm font-semibold text-text">{tr("Semua tenang")}</p><p className="mt-1 text-xs leading-relaxed text-textMuted">{tr("Belum ada notifikasi tersimpan.")}</p></div>}</div>
   <div className="flex items-center justify-between gap-3 border-t border-border bg-bg/55 px-4 py-2.5"><Link href="/reminders" onClick={()=>setOpen(false)} className="text-[10px] font-semibold text-accent">{tr("Kelola pengingat →")}</Link><span className="text-right text-[9px] text-textMuted">{tr("Push:")} {push==="subscribed"?"aktif":push==="unconfigured"?tr("server belum siap"):push==="denied"?"diblokir":push==="error"?tr("perlu diperbaiki"):tr("belum aktif")}</span></div>
  </div></>}
 </div>
}
