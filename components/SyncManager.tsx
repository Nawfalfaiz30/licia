"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { getDeviceId } from "@/lib/pwa/offlineQueue";
import { applySyncedPreferences } from "@/lib/preferences";

import { useLanguage } from "@/components/LanguageProvider";
const CURSOR_KEY = "licia-sync-cursor-v2";

type SyncPrefs = {
  enabled: boolean;
  onFocus: boolean;
  showStatus: boolean;
  onNetworkChange: boolean;
  onVisibility: boolean;
  seconds: number;
};
function preferences(): SyncPrefs {
  const bool = (key: string, fallback: boolean) => { try { const value = localStorage.getItem(key); return value === null ? fallback : value === "true"; } catch { return fallback; } };
  const seconds = (() => { try { const n = Number(localStorage.getItem("licia-sync-interval-seconds")); return [10, 15, 30, 60, 120].includes(n) ? n : 15; } catch { return 15; } })();
  return {
    enabled: bool("licia-sync-enabled", true),
    onFocus: bool("licia-sync-on-focus", true),
    showStatus: bool("licia-show-sync-status", true),
    onNetworkChange: bool("licia-sync-on-network-change", true),
    onVisibility: bool("licia-sync-on-visibility", true),
    seconds,
  };
}

export function SyncManager() {
  const { t: tr } = useLanguage();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [conflicts, setConflicts] = useState(0);
  const [resyncRequired, setResyncRequired] = useState(false);
  const [lastSyncTick, setLastSyncTick] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const cursorRef = useRef(0);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => router.refresh(), 350);
  }, [router]);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sync/status", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setConflicts(Number(data?.openConflicts || 0));
    } catch {}
  }, []);

  const registerAndPull = useCallback(async (force = false) => {
    const pref = preferences();
    setEnabled(pref.enabled); setShowStatus(pref.showStatus);
    if (!pref.enabled || !navigator.onLine || activeRef.current) return;
    if (!force && document.visibilityState !== "visible") return;
    activeRef.current = true;
    setSyncing(true);
    window.dispatchEvent(new CustomEvent("licia:sync-status", { detail: { state: "syncing" } }));
    try {
      const id = getDeviceId();
      await fetch("/api/sync/register-device", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ deviceId: id, deviceName: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Licia Mobile" : "Licia Desktop", platform: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile-web" : "desktop-web", appVersion: "0.35.0" }) });
      const saved = Number(localStorage.getItem(CURSOR_KEY) || 0);
      cursorRef.current = Number.isFinite(saved) ? saved : 0;
      // Bootstrap account-level settings only for a fresh device. Existing devices
      // receive preference changes through the normal sync event stream.
      if (cursorRef.current === 0) {
        try {
          const preferenceResponse = await fetch("/api/sync/preferences", { cache: "no-store", credentials: "include" });
          if (preferenceResponse.ok) {
            const preferenceData = await preferenceResponse.json().catch(() => ({}));
            if (preferenceData?.preferences && typeof preferenceData.preferences === "object") {
              applySyncedPreferences(preferenceData.preferences);
              window.dispatchEvent(new CustomEvent("licia:preferences-sync", { detail: preferenceData.preferences }));
            }
          }
        } catch {}
      }
      let cursor = cursorRef.current;
      if (cursor === 0) {
        const bootstrap = await fetch(`/api/sync/pull?cursor=0&deviceId=${encodeURIComponent(id)}`, { cache: "no-store", credentials: "include" });
        if (bootstrap.ok) {
          const data = await bootstrap.json();
          cursor = Number(data?.nextCursor || 0);
          cursorRef.current = cursor;
          localStorage.setItem(CURSOR_KEY, String(cursor));
        }
      }
      let loops = 0;
      while (loops++ < 6) {
        const res = await fetch(`/api/sync/pull?cursor=${cursor}&limit=200&deviceId=${encodeURIComponent(id)}`, { cache: "no-store", credentials: "include" });
        if (!res.ok) break;
        const data = await res.json();
        if (data?.resyncRequired) {
          localStorage.removeItem(CURSOR_KEY);
          cursor = 0;
          cursorRef.current = 0;
          scheduleRefresh();
          window.dispatchEvent(new CustomEvent("licia:sync-resync-required", { detail: data }));
          window.dispatchEvent(new CustomEvent("licia:sync-status", { detail: { state: "resync_required" } }));
          break;
        }
        const events = Array.isArray(data?.events) ? data.events : [];
        const next = Number(data?.nextCursor ?? cursor);
        if (events.length) {
          window.dispatchEvent(new CustomEvent("licia:sync-events", { detail: { events, cursor: next } }));
          const preferenceEvent = events.find((event: any) => event.entity_type === "preferences");
          if (preferenceEvent?.payload?.preferences) {
            applySyncedPreferences(preferenceEvent.payload.preferences);
            window.dispatchEvent(new CustomEvent("licia:preferences-sync", { detail: preferenceEvent.payload.preferences }));
          }
          scheduleRefresh();
        }
        cursor = next;
        cursorRef.current = cursor;
        localStorage.setItem(CURSOR_KEY, String(cursor));
        if (!data?.hasMore) break;
      }
      setLastSync(Date.now());
      setLastSyncTick(Date.now());
      setResyncRequired(false);
      try {
        if (localStorage.getItem("licia-daily-snapshot") !== "false") {
          const snapshotMarker = localStorage.getItem("licia-daily-snapshot-date");
          if (!snapshotMarker) {
            const snapshotResponse = await fetch("/api/intelligence/daily-snapshot", { cache: "no-store", credentials: "include" });
            const snapshotData = await snapshotResponse.json().catch(() => ({}));
            if (snapshotResponse.ok && snapshotData?.snapshotDate) localStorage.setItem("licia-daily-snapshot-date", String(snapshotData.snapshotDate));
          }
        }
      } catch {}
      window.dispatchEvent(new CustomEvent("licia:offline-queue-change"));
      await loadStatus();
      window.dispatchEvent(new CustomEvent("licia:sync-complete", { detail: { cursor: cursorRef.current } }));
      window.dispatchEvent(new CustomEvent("licia:sync-status", { detail: { state: "online", cursor: cursorRef.current } }));
    } catch {
      window.dispatchEvent(new CustomEvent("licia:sync-status", { detail: { state: "degraded" } }));
    } finally {
      activeRef.current = false;
      setSyncing(false);
    }
  }, [loadStatus, scheduleRefresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const refreshPreferences = () => { const p = preferences(); setEnabled(p.enabled); setShowStatus(p.showStatus); };
    const schedule = () => { if (timerRef.current) window.clearInterval(timerRef.current); const seconds = preferences().seconds; timerRef.current = window.setInterval(() => void registerAndPull(), seconds * 1000); };
    const onOnline = () => { setOnline(true); if (preferences().onNetworkChange) void registerAndPull(true); };
    const onOffline = () => { setOnline(false); window.dispatchEvent(new CustomEvent("licia:sync-status", { detail: { state: "offline" } })); };
    const onFocus = () => { if (preferences().onFocus) void registerAndPull(true); };
    const onVisibility = () => { if (document.visibilityState === "visible" && preferences().onVisibility) void registerAndPull(true); };
    const onPreferences = () => { refreshPreferences(); schedule(); if (preferences().enabled) void registerAndPull(true); };
    const onManualSync = () => { void registerAndPull(true); };
    const ageTimer = window.setInterval(() => setLastSyncTick(Date.now()), 1000);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); window.addEventListener("focus", onFocus);
    window.addEventListener("licia:sync-request", onManualSync);
    document.addEventListener("visibilitychange", onVisibility); window.addEventListener("licia:preferences-change", onPreferences);

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !preferences().enabled) return;
      channel = supabase.channel(`licia-sync-${data.user.id.slice(0, 12)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "life_os_sync_events", filter: `user_id=eq.${data.user.id}` }, () => { void registerAndPull(true); })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "life_os_sync_conflicts", filter: `user_id=eq.${data.user.id}` }, () => { void loadStatus(); window.dispatchEvent(new CustomEvent("licia:sync-conflict")); })
        .subscribe();
    });

    refreshPreferences();
    schedule();
    void loadStatus();
    void registerAndPull(true);
    return () => {
      channel?.unsubscribe();
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      window.clearInterval(ageTimer);
      window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("focus", onFocus);
      window.removeEventListener("licia:sync-request", onManualSync);
      document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("licia:preferences-change", onPreferences);
    };
  }, [loadStatus, registerAndPull]);

  if (!showStatus || !enabled) return null;
  const label = syncing ? "Menyinkronkan…" : !online ? "Offline" : resyncRequired ? tr("Perlu sinkron ulang") : conflicts > 0 ? `${conflicts} konflik` : lastSync ? `Tersinkron ${Math.max(0, Math.round((lastSyncTick-lastSync)/1000))}d` : "Sinkron aktif";
  return <div className="pointer-events-none fixed bottom-[calc(5.35rem+env(safe-area-inset-bottom))] right-3 z-float sm:bottom-[5.5rem]">
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-2.5 py-1.5 text-2xs font-medium text-textMuted shadow-lg backdrop-blur-xl">
      {syncing ? <RefreshCw size={11} className="animate-spin text-accent"/> : !online ? <CloudOff size={11} className="text-warning"/> : resyncRequired ? <AlertTriangle size={11} className="text-warning"/> : conflicts > 0 ? <AlertTriangle size={11} className="text-warning"/> : <Cloud size={11} className="text-success"/>}
      <span>{label}</span>
    </div>
  </div>;
}
