"use client";

import Link from "next/link";
import { QueueCenter } from "@/components/v35/QueueCenter";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Laptop, RefreshCw, Smartphone, GitMerge } from "lucide-react";
import { Card, PrimaryButton, SoftButton, notifyToast } from "@/components/ui";
import { ConflictCenter } from "@/components/sync/ConflictCenter";
import { countOfflineActions, getDeviceId } from "@/lib/pwa/offlineQueue";
import { useLanguage } from "@/components/LanguageProvider";

type Device = {
  device_id: string;
  device_name: string | null;
  platform: string | null;
  app_version: string | null;
  last_seen_at: string | null;
  last_cursor: number;
  sync_status: string;
  last_error: string | null;
  online: boolean;
};

type StatusData = { devices: Device[]; openConflicts: number; pendingMutations: number };

export default function SyncPage() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState<StatusData | null>(null);
  const [queue, setQueue] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [statusRes, localQueue] = await Promise.all([
        fetch("/api/sync/status", { cache: "no-store", credentials: "include" }),
        countOfflineActions(),
      ]);
      const status = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok) throw new Error(status?.error || tr("Status sinkronisasi tidak tersedia."));
      setData(status);
      setQueue(localQueue);
    } catch (error) {
      notifyToast({ title: tr("Status sinkronisasi belum tersedia"), message: error instanceof Error ? error.message : tr("Coba lagi."), tone: "error" });
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("licia:offline-queue-change", onChange);
    window.addEventListener("licia:sync-complete", onChange);
    window.addEventListener("licia:sync-conflict", onChange);
    return () => {
      window.removeEventListener("licia:offline-queue-change", onChange);
      window.removeEventListener("licia:sync-complete", onChange);
      window.removeEventListener("licia:sync-conflict", onChange);
    };
  }, [load]);

  function manualSync() {
    window.dispatchEvent(new CustomEvent("licia:sync-request"));
    notifyToast({ title: tr("Sinkronisasi dimulai"), message: tr("Licia akan mengambil perubahan terbaru dan memproses antrean."), tone: "success" });
  }

  function forceResync() {
    localStorage.removeItem("licia-sync-cursor-v2");
    window.dispatchEvent(new CustomEvent("licia:sync-request"));
    notifyToast({ title: tr("Sinkronisasi penuh dimulai"), message: tr("Cursor lokal direset dan data terbaru akan diambil kembali."), tone: "success" });
  }

  return <div id="sync" className="space-y-5 licia-v33-page-in">
    <header className="rounded-[2rem] border border-accent/15 bg-accent/5 p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-accent">{tr("PUSAT SINKRONISASI")}</p>
          <h1 className="mt-1 font-display text-3xl text-text">{tr("Semua perangkat tetap selaras.")}</h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-textMuted">{tr("Lihat perangkat aktif, antrean offline, konflik, dan posisi sinkronisasi dari satu tempat.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SoftButton onClick={() => void load()} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""}/> {tr("Segarkan")}</SoftButton>
          <PrimaryButton onClick={manualSync}><Cloud size={14}/> {tr("Sinkronkan sekarang")}</PrimaryButton>
        </div>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["Perubahan menunggu", String(queue), "Di perangkat ini"],
        ["Mutasi server", String(data?.pendingMutations ?? 0), "Sedang diproses"],
        ["Konflik", String(data?.openConflicts ?? 0), "Perlu ditinjau"],
        ["Perangkat", String(data?.devices?.length ?? 0), "Terdaftar"],
      ].map(([label, value, hint]) => <Card key={label} className="p-4"><p className="text-[10px] text-textMuted">{label}</p><p className="mt-1 text-2xl font-semibold text-text">{value}</p><p className="mt-1 text-[9px] text-textMuted">{hint}</p></Card>)}
    </section>

    <QueueCenter />

  <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-textMuted">{tr("Perangkat")}</p><h2 className="mt-1 font-display text-2xl text-text">{tr("Perangkat yang pernah terhubung")}</h2></div><span className="rounded-full border border-border px-2.5 py-1 text-[9px] font-medium text-textMuted">{tr("ID:")} {getDeviceId().slice(0, 18)}…</span></div>
      <div className="mt-4 space-y-2">
        {(data?.devices || []).map((device) => {
          const isMobile = String(device.platform || "").includes("mobile");
          return <div key={device.device_id} className="licia-v33-interactive flex flex-col gap-3 rounded-2xl border border-border bg-bg/55 p-3 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">{isMobile ? <Smartphone size={17}/> : <Laptop size={17}/>}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-text">{device.device_name || tr("Perangkat Licia")}</p><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${device.online ? "bg-success/10 text-success" : "bg-bg text-textMuted"}`}>{device.online ? <CheckCircle2 size={10}/> : <CloudOff size={10}/>} {device.online ? tr("Online") : tr("Offline")}</span></div><p className="mt-1 text-[9px] text-textMuted">{device.platform || "web"} · {device.app_version || "—"} {tr("· cursor")} {device.last_cursor ?? 0}</p><p className="mt-1 break-words text-[9px] text-textMuted">{tr("Terakhir terlihat")} {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString(locale) : "—"}{device.last_error ? ` · ${device.last_error}` : ""}</p></div>
            {device.sync_status === "resync_required" && <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-[9px] font-semibold text-warning"><AlertTriangle size={10}/> {tr("Perlu sinkron ulang")}</span>}
          </div>;
        })}
        {!data?.devices?.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-textMuted">{tr("Belum ada perangkat yang tercatat.")}</div>}
      </div>
    </Card>

    <section className="grid gap-4 lg:grid-cols-2">
      <Card id="conflicts" className="scroll-mt-24 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-warning/10 p-3 text-warning"><GitMerge size={18}/></span><div><h2 className="text-sm font-semibold text-text">{tr("Konflik perubahan")}</h2><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Perbedaan versi disimpan di server agar tidak hilang. Tinjau dan pilih hasil yang sesuai.")}</p></div></div><div className="mt-4"><ConflictCenter onChanged={() => void load()} /></div></Card>
      <Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><RefreshCw size={18}/></span><div><h2 className="text-sm font-semibold text-text">{tr("Pemulihan sinkronisasi")}</h2><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Gunakan reset cursor jika riwayat event sudah dipangkas atau perangkat lama perlu menarik ulang perubahan.")}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><SoftButton onClick={forceResync}><RefreshCw size={13}/> {tr("Sinkron penuh")}</SoftButton><Link href="/settings" className="rounded-xl bg-bg px-3 py-2 text-[10px] font-semibold text-textMuted">{tr("Buka pengaturan")}</Link></div></Card>
    </section>

    <Card className="border-accent/15 bg-accent/5 p-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Cloud size={16}/></span><div><p className="text-sm font-semibold text-text">{tr("Mode offline siap dipakai")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Perubahan saat offline masuk antrean perangkat dan dikirim kembali memakai mutation ID yang dapat diproses ulang tanpa membuat duplikasi.")}</p></div></div></Card>
  </div>;
}
