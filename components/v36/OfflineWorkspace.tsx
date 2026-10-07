"use client";
import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, Database } from "lucide-react";
import { Card, SoftButton } from "@/components/ui";
import { cacheWorkspaceSnapshot, getWorkspaceSnapshot } from "@/lib/pwa/offlineQueue";
import { createClient } from "@/lib/supabase/client";

import { useLanguage } from "@/components/LanguageProvider";
import { documentLocale } from "@/lib/format";
export function OfflineWorkspace() {
  const { t: tr } = useLanguage();
  const [online, setOnline] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cachedMove, setCachedMove] = useState<string | null>(null);
  async function hydrate() {
    try {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user) return;
      const r = await fetch("/api/v36/copilot", { cache: "no-store" });
      if (!r.ok) {
        const cached = await getWorkspaceSnapshot<any>(user.id, "copilot");
        if (cached) {
          setCachedAt(cached.updatedAt);
          setCachedMove(cached.snapshot?.nextMove || null);
        }
        return;
      }
      const snapshot = await r.json();
      await cacheWorkspaceSnapshot(user.id, "copilot", snapshot);
      setCachedAt(new Date().toISOString());
      setCachedMove(snapshot?.nextMove || null);
    } catch {}
  }
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    (async () => {
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        if (!user) return;
        const r = await fetch("/api/v36/copilot", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          await cacheWorkspaceSnapshot(user.id, "copilot", d);
          setCachedAt(new Date().toISOString());
          setCachedMove(d?.nextMove || null);
          return;
        }
        const cached = await getWorkspaceSnapshot<any>(user.id, "copilot");
        if (cached) {
          setCachedAt(cached.updatedAt);
          setCachedMove(cached.snapshot?.nextMove || null);
        }
      } catch {}
    })();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  async function refresh() {
    setBusy(true);
    await hydrate();
    setBusy(false);
  }
  return (
    <Card className="border-accent/15 p-4">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-accent/10 p-3 text-accent">
          {online ? <Cloud size={16} /> : <CloudOff size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-text">{tr("Workspace offline")}</p>
          <p className="mt-1 text-2xs text-textMuted">
            {online
              ? tr("Data penting terakhir disiapkan untuk mode offline.")
              : tr("Kamu sedang offline. Antrean perubahan tetap berjalan lokal.")}
          </p>
        </div>
        <SoftButton onClick={() => void refresh()} disabled={busy} className="min-h-9 px-2.5">
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
        </SoftButton>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-bg p-3">
        <Database size={13} className="mt-0.5 text-accent" />
        <div>
          <p className="text-2xs text-textMuted">
            {tr("Snapshot Copilot:")}{" "}
            {cachedAt
              ? new Date(cachedAt).toLocaleTimeString(documentLocale(), { hour: "2-digit", minute: "2-digit" })
              : tr("belum ada")}
          </p>
          {cachedMove && <p className="mt-1 text-2xs font-medium leading-relaxed text-text">{cachedMove}</p>}
        </div>
      </div>
    </Card>
  );
}
