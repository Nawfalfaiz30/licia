"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
const KEY="licia-data-revision";
export function DataRefreshBridge(){const router=useRouter();useEffect(()=>{const refresh=()=>router.refresh();const storage=(event:StorageEvent)=>{if(event.key===KEY)refresh();};window.addEventListener("licia:data-invalidated",refresh);window.addEventListener("storage",storage);return()=>{window.removeEventListener("licia:data-invalidated",refresh);window.removeEventListener("storage",storage);};},[router]);return null;}
