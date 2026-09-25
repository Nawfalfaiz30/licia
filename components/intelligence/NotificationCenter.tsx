"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Check, ExternalLink, RefreshCw, Sparkles, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { subscribeToLiciaPush, getPushStatus, type PushClientState } from "@/lib/notifications/client";
import { notifyToast } from "@/components/ui";

type Notice = { id:string; title:string; body:string|null; href:string; tone:string; read_at:string|null; delivered_at:string|null; created_at:string };
const toneIcon=(tone:string):LucideIcon=>tone==="danger"?AlertTriangle:tone==="success"?Check:Sparkles;

export function NotificationCenter(){
 const [open,setOpen]=useState(false); const [rows,setRows]=useState<Notice[]>([]); const [loading,setLoading]=useState(false); const [push,setPush]=useState<PushClientState>("permission");
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
      const data=await res.json();
      const next:Notice[]=Array.isArray(data.notifications)?data.notifications:[];
      const fresh=next.filter(item=>!knownIds.current.has(item.id) && !item.read_at);
      setRows(next);
      try {
        const enabled=localStorage.getItem("licia-browser-notifications")==="true";
        if(enabled && Notification.permission==="granted") {
          const candidates=initialized.current ? fresh : next.filter(item=>!item.read_at && Date.now()-new Date(item.created_at).getTime() <= 90_000);
          const candidate=candidates.find(item=>!notifiedIds.current.has(item.id));
          if(candidate) {
            new Notification(candidate.title,{body:candidate.body||"Ada kabar baru dari Licia.",icon:"/icon-192.png",tag:candidate.id});
            notifiedIds.current.add(candidate.id);
          }
        }
      } catch {}
      if(!initialized.current){ initialized.current=true; }
      knownIds.current=new Set(next.map(item=>item.id));
      lastLoaded.current=now;
    }
  } catch {} finally { setLoading(false); }
 }
 useEffect(()=>{void dispatchAndLoad(true);void getPushStatus().then(setPush);const onFocus=()=>void dispatchAndLoad();const onVisible=()=>{if(document.visibilityState==="visible")void dispatchAndLoad()};const onPush=()=>void getPushStatus().then(setPush);window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onVisible);window.addEventListener("licia:push-status-change",onPush);return()=>{window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("licia:push-status-change",onPush)}},[]);
 useEffect(()=>{if(open)void dispatchAndLoad(true)},[open]);
 useEffect(()=>{let timer:number|undefined;let interval=1;try{const raw=Number(localStorage.getItem("licia-notification-poll-minutes"));if([1,2,5,10].includes(raw))interval=raw}catch{} timer=window.setInterval(()=>void dispatchAndLoad(true),interval*60_000);return()=>{if(timer)window.clearInterval(timer)}},[]);
 const unread=rows.filter(x=>!x.read_at).length;
 async function mark(id:string){setRows(x=>x.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}).catch(()=>null)}
 async function markAll(){setRows(x=>x.map(n=>({...n,read_at:n.read_at||new Date().toISOString()})));await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({all:true})}).catch(()=>null)}
 async function enablePush(){const result=await subscribeToLiciaPush();setPush(result.state);if(!result.ok)notifyToast({title:"Notifikasi belum aktif",message:result.error||"Periksa izin browser.",tone:"error"});else notifyToast({title:"Notifikasi aktif",message:"Licia dapat mengirim reminder ke perangkat ini.",tone:"success"})}
 return <div className="relative">
  <button onClick={()=>setOpen(v=>!v)} className="touch-target relative flex items-center justify-center rounded-xl border border-border bg-surface text-textMuted shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent" aria-label="Pusat notifikasi" title="Notifikasi"><Bell size={17}/>{unread>0&&<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-sm">{unread>9?"9+":unread}</span>}</button>
  {open&&<><button className="fixed inset-0 z-[110] bg-black/10 backdrop-blur-[1px]" aria-label="Tutup notifikasi" onClick={()=>setOpen(false)}/><div className="licia-notification-panel absolute right-0 top-[calc(100%+.65rem)] z-[120] w-[min(94vw,410px)] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-licia-pop-in">
   <div className="border-b border-border bg-bg/80 px-4 py-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-lg bg-accent/10 p-1.5 text-accent"><Bell size={13}/></span><p className="text-sm font-semibold text-text">Notifikasi</p>{unread>0&&<span className="rounded-full bg-danger/10 px-2 py-0.5 text-[9px] font-bold text-danger">{unread} baru</span>}</div><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Pengingat dan sinyal Licia tersimpan, tidak hilang ketika halaman berganti.</p></div><div className="flex items-center gap-1">{push!=="subscribed"&&push!=="unsupported"&&push!=="denied"&&<button type="button" onClick={()=>void enablePush()} className="rounded-lg border border-accent/20 bg-accent/5 px-2 py-1.5 text-[10px] font-semibold text-accent">Aktifkan push</button>}<button type="button" onClick={()=>void markAll()} className="rounded-lg p-2 text-textMuted hover:bg-surface hover:text-accent" title="Tandai semua dibaca"><Check size={14}/></button><button type="button" onClick={()=>void dispatchAndLoad(true)} className="rounded-lg p-2 text-textMuted hover:bg-surface hover:text-accent" title="Segarkan"><RefreshCw size={14} className={loading?"animate-spin":""}/></button><button type="button" onClick={()=>setOpen(false)} className="rounded-lg p-2 text-textMuted hover:bg-surface hover:text-text" title="Tutup"><X size={14}/></button></div></div></div>
   <div className="max-h-[62vh] overflow-y-auto bg-surface p-2">{loading&&!rows.length?<div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"/><p className="text-xs text-textMuted">Memuat notifikasi…</p></div>:rows.length?rows.map(r=>{const Icon=toneIcon(r.tone);return <Link key={r.id} href={r.href||"/"} onClick={()=>{void mark(r.id);setOpen(false)}} className={clsx("group mx-1 my-1 block rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm",!r.read_at?"border-accent/15 bg-accent/[0.055]":"border-border bg-bg/45")}><div className="flex gap-3"><div className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",r.tone==="danger"?"bg-danger/10 text-danger":"bg-accent/10 text-accent")}><Icon size={14}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="break-words text-xs font-semibold text-text">{r.title}</p>{!r.read_at&&<span className="text-[9px] font-bold text-accent">Baru</span>}</div><p className="mt-1 break-words text-[11px] leading-relaxed text-textMuted">{r.body||"Tidak ada detail tambahan."}</p><p className="mt-2 text-[9px] text-textMuted">{new Date(r.created_at).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}{r.delivered_at?" · push dikirim":" · tersimpan"}</p></div><ExternalLink size={12} className="mt-1 shrink-0 text-textMuted transition group-hover:text-accent"/></div></Link>}) : <div className="px-4 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Bell size={18}/></div><p className="mt-3 text-sm font-semibold text-text">Semua tenang</p><p className="mt-1 text-xs leading-relaxed text-textMuted">Belum ada notifikasi tersimpan.</p></div>}</div>
   <div className="flex items-center justify-between gap-3 border-t border-border bg-bg/55 px-4 py-2.5"><Link href="/reminders" onClick={()=>setOpen(false)} className="text-[10px] font-semibold text-accent">Kelola pengingat →</Link><span className="text-right text-[9px] text-textMuted">Push: {push==="subscribed"?"aktif":push==="unconfigured"?"server belum siap":push==="denied"?"diblokir":"belum aktif"}</span></div>
  </div></>}
 </div>
}
