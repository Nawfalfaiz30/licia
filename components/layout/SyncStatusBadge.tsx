"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { countOfflineActions } from "@/lib/pwa/offlineQueue";
import { clsx } from "clsx";
import { useLanguage } from "@/components/LanguageProvider";

export function SyncStatusBadge() {
  const { tr } = useLanguage();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (cancelled) return;
      setOnline(navigator.onLine);
      setQueued(await countOfflineActions().catch(() => 0));
      try {
        const response = await fetch("/api/sync/status", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setConflicts(Number(data?.openConflicts || 0));
        }
      } catch {}
    };
    const onStatus = (event: Event) => {
      const state = (event as CustomEvent<{ state?: string }>).detail?.state;
      setSyncing(state === "syncing");
      if (state === "offline") setOnline(false);
      if (state === "online") setOnline(true);
      void refresh();
    };
    const onQueue = () => void refresh();
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("online", onQueue);
    window.addEventListener("offline", onQueue);
    window.addEventListener("licia:sync-status", onStatus);
    window.addEventListener("licia:offline-queue-change", onQueue);
    window.addEventListener("licia:sync-conflict", onQueue);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onQueue);
      window.removeEventListener("offline", onQueue);
      window.removeEventListener("licia:sync-status", onStatus);
      window.removeEventListener("licia:offline-queue-change", onQueue);
      window.removeEventListener("licia:sync-conflict", onQueue);
    };
  }, []);

  const tone = !online ? "warning" : conflicts > 0 ? "warning" : queued > 0 || syncing ? "accent" : "success";
  const label = syncing ? tr("Menyinkronkan") : !online ? tr("Offline") : conflicts > 0 ? `${conflicts} konflik` : queued > 0 ? `${queued} menunggu` : tr("Tersinkron");
  const Icon = syncing ? RefreshCw : !online ? CloudOff : conflicts > 0 ? AlertTriangle : Cloud;

  return (
    <Link
      href="/sync"
      className={clsx(
        "licia-v33-interactive hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold backdrop-blur-xl",
        tone === "warning" && "border-warning/20 bg-warning/5 text-warning",
        tone === "accent" && "border-accent/20 bg-accent/5 text-accent",
        tone === "success" && "border-success/20 bg-success/5 text-success",
      )}
      title={tr("Buka Pusat Sinkronisasi")}
    >
      <Icon size={12} className={syncing ? "animate-spin" : ""} />
      {label}
    </Link>
  );
}
