"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { countOfflineActions } from "@/lib/pwa/offlineQueue";
import { clsx } from "clsx";
import { useLanguage } from "@/components/LanguageProvider";
function rel(at: number | null) {
  if (!at) return "baru saja";
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  return m < 1 ? "baru saja" : m === 1 ? "1 mnt lalu" : `${m} mnt lalu`;
}
export function SyncStatusBadge() {
  const { t } = useLanguage();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(Date.now());
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (cancelled) return;
      setOnline(navigator.onLine);
      setQueued(await countOfflineActions().catch(() => 0));
      try {
        const response = await fetch("/api/sync/status", { cache: "no-store" });
        if (response.ok && !cancelled) {
          const d = await response.json();
          const c = Number(d?.openConflicts || 0);
          setConflicts(c);
          if (navigator.onLine && c === 0) setLastSyncedAt(Date.now());
        }
      } catch {}
    };
    const onStatus = (event: Event) => {
      const s = (event as CustomEvent<{ state?: string }>).detail?.state;
      setSyncing(s === "syncing");
      if (s === "offline") setOnline(false);
      if (s === "online") setOnline(true);
      void refresh();
    };
    const onQueue = () => void refresh();
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
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
  const tone = !online || conflicts > 0 ? "warning" : queued > 0 || syncing ? "accent" : "success";
  const label = syncing
    ? t("Menyinkronkan")
    : !online
      ? t("Offline")
      : conflicts > 0
        ? t("{conflicts} konflik", { conflicts })
        : queued > 0
          ? t("{queued} menunggu", { queued })
          : t("Tersinkron · {relative}", { relative: rel(lastSyncedAt) });
  const Icon = syncing ? RefreshCw : !online ? CloudOff : conflicts > 0 ? AlertTriangle : Cloud;
  return (
    <Link
      href="/sync"
      aria-label={label}
      title={label}
      className={clsx(
        "licia-sync-icon touch-target inline-flex items-center justify-center rounded-xl border bg-surface transition",
        tone === "warning" && "border-danger/20 bg-danger/5 text-danger",
        tone === "accent" && "border-accent/20 bg-accent/5 text-accent",
        tone === "success" && "border-success/20 bg-success/5 text-success",
      )}
    >
      <Icon size={17} className={syncing ? "animate-spin" : ""} aria-hidden />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
