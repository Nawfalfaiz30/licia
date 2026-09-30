"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";

type State={openConflicts:number;pendingMutations:number;online:boolean;devices:number};
export function SyncHealthStrip(){
 const [state,setState]=useState<State|null>(null);
 useEffect(()=>{let active=true; const load=()=>fetch('/api/sync/status',{credentials:'include',cache:'no-store'}).then(r=>r.json()).then(j=>active&&setState({openConflicts:Number(j.openConflicts||0),pendingMutations:Number(j.pendingMutations||0),online:navigator.onLine,devices:Array.isArray(j.devices)?j.devices.length:0})).catch(()=>active&&setState({openConflicts:0,pendingMutations:0,online:navigator.onLine,devices:0})); load(); const timer=window.setInterval(load,30000); const on=()=>setState(v=>v?{...v,online:true}:{openConflicts:0,pendingMutations:0,online:true,devices:0}); const off=()=>setState(v=>v?{...v,online:false}:{openConflicts:0,pendingMutations:0,online:false,devices:0}); window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[]);
 if(!state) return null; const healthy=state.online && state.openConflicts===0 && state.pendingMutations===0;
 return <Link href="/sync" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[9px] text-textMuted hover:border-accent/20"><span className={`inline-flex h-2 w-2 rounded-full ${healthy?'bg-success':'bg-warning'}`}/>{state.online?<Wifi size={12} className="text-accent"/>:<CloudOff size={12} className="text-danger"/>}<span>{state.online?'Tersinkron':'Offline'}</span>{state.pendingMutations>0&&<span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-accent">↑ {state.pendingMutations}</span>}{state.openConflicts>0&&<span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-danger">{state.openConflicts} konflik</span>}<span className="ml-auto flex items-center gap-1"><RefreshCw size={10}/> {state.devices} perangkat</span></Link>;
}
