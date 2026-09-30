"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Cloud, GitMerge, MonitorSmartphone, RefreshCw, Server, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { haptic } from "@/lib/interaction";
import { notifyToast } from "@/components/ui";

type Conflict = {
  id: string;
  device_id: string;
  mutation_id: string;
  entity_type: string;
  entity_id: string | null;
  strategy: string;
  client_version: number | null;
  server_version: number | null;
  client_payload: Record<string, unknown>;
  server_payload: Record<string, unknown>;
  conflicting_fields: string[];
  created_at: string;
};

const labels: Record<string, string> = {
  task: "Tugas", schedule: "Agenda", project: "Proyek", goal: "Target", note: "Catatan", inbox: "Inbox", reminder: "Pengingat", memory: "Memori",
  subtask: "Subtugas", milestone: "Milestone", decision: "Keputusan", skill: "Keahlian", expense: "Pengeluaran", income: "Pemasukan", subscription: "Langganan",
  sleep: "Tidur", hydration: "Hidrasi", caffeine: "Kafein", meal: "Makanan", medication: "Obat", fatigue: "Kondisi", movement: "Gerak", healthMetric: "Metrik kesehatan",
  budget: "Anggaran", account: "Akun", automation: "Otomatisasi", vault: "Vault",
  pomodoro: "Sesi fokus", habit: "Rutinitas", habitCheckin: "Riwayat rutinitas", reading: "Bacaan", readingSession: "Sesi membaca", relation: "Relasi", interaction: "Interaksi",
};

function preview(payload: Record<string, unknown>) {
  const title = payload.title ?? payload.name ?? payload.content ?? payload.memory_value;
  if (title) return String(title).slice(0, 110);
  return Object.entries(payload).filter(([key]) => !["id", "user_id", "version", "created_at", "updated_at"].includes(key)).slice(0, 2).map(([key, value]) => `${key}: ${String(value).slice(0, 50)}`).join(" · ") || "Perubahan data";
}

export function ConflictCenter({ onChanged }: { onChanged?: () => void }) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/sync/conflicts", { cache: "no-store", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Konflik tidak dapat dimuat.");
      setConflicts(Array.isArray(data?.conflicts) ? data.conflicts : []);
    } catch (error) {
      notifyToast({ title: "Konflik gagal dimuat", message: error instanceof Error ? error.message : "Coba lagi.", tone: "error" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const onConflict = () => void load();
    window.addEventListener("licia:sync-conflict", onConflict);
    return () => window.removeEventListener("licia:sync-conflict", onConflict);
  }, [load]);

  async function resolve(conflict: Conflict, resolution: "server" | "client" | "merge" | "discard") {
    setBusy(`${conflict.id}:${resolution}`);
    try {
      const response = await fetch("/api/sync/resolve", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conflictId: conflict.id, resolution }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Resolusi gagal.");
      haptic("success");
      notifyToast({ title: resolution === "client" ? "Versi perangkat dipakai" : resolution === "server" ? "Versi server dipertahankan" : resolution === "merge" ? "Perubahan aman digabungkan" : "Konflik dibuang", message: `${labels[conflict.entity_type] || conflict.entity_type} berhasil diselesaikan.`, tone: "success" });
      await load();
      onChanged?.();
      window.dispatchEvent(new CustomEvent("licia:sync-request"));
    } catch (error) {
      haptic("warning");
      notifyToast({ title: "Resolusi gagal", message: error instanceof Error ? error.message : "Coba lagi.", tone: "error" });
    } finally { setBusy(null); }
  }

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] text-textMuted">{loading ? "Memeriksa konflik…" : conflicts.length ? `${conflicts.length} perubahan perlu ditinjau.` : "Tidak ada konflik terbuka."}</p>
      <button type="button" onClick={() => void load()} disabled={loading} className="touch-target inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px] font-semibold text-textMuted hover:bg-bg hover:text-accent" title="Segarkan konflik"><RefreshCw size={12} className={loading ? "animate-spin" : ""}/> Segarkan</button>
    </div>
    {!loading && !conflicts.length && <div className="rounded-2xl border border-success/20 bg-success/5 p-4 text-center"><Check size={20} className="mx-auto text-success"/><p className="mt-2 text-xs font-semibold text-text">Semua perubahan selaras</p><p className="mt-1 text-[10px] text-textMuted">Perangkat Licia tidak memiliki benturan data yang perlu ditinjau.</p></div>}
    {conflicts.map((conflict) => <article key={conflict.id} className="licia-conflict-card rounded-2xl border border-border bg-bg/70 p-3.5 transition">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-warning/10 p-2.5 text-warning"><AlertTriangle size={15}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-text">{labels[conflict.entity_type] || conflict.entity_type}</p><span className="rounded-full bg-accent/10 px-2 py-0.5 text-[8px] font-semibold text-accent">v{conflict.server_version ?? "?"} vs v{conflict.client_version ?? "?"}</span></div><p className="mt-1 break-words text-[10px] text-textMuted">{preview(conflict.client_payload)}</p><div className="mt-2 flex flex-wrap gap-2 text-[9px] text-textMuted"><span className="inline-flex items-center gap-1"><MonitorSmartphone size={10}/> {String(conflict.device_id).slice(0, 22)}</span><span className="inline-flex items-center gap-1"><Cloud size={10}/> Server: {preview(conflict.server_payload).slice(0, 50)}</span></div></div></div>
      {!!conflict.conflicting_fields?.length && <div className="mt-3 flex flex-wrap gap-1.5">{conflict.conflicting_fields.slice(0, 12).map((field) => <span key={field} className="rounded-full border border-border bg-surface px-2 py-1 text-[8px] text-textMuted">{field}</span>)}</div>}
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4"><button type="button" disabled={busy !== null} onClick={() => void resolve(conflict,"server")} className={clsx("min-h-9 rounded-xl border border-border bg-surface px-2 text-[9px] font-semibold text-textMuted transition hover:border-accent/20 hover:text-accent",busy===`${conflict.id}:server` && "opacity-60")}><Server size={11} className="mx-auto mb-0.5"/>Pakai server</button><button type="button" disabled={busy !== null} onClick={() => void resolve(conflict,"client")} className={clsx("min-h-9 rounded-xl border border-accent/20 bg-accent/5 px-2 text-[9px] font-semibold text-accent transition hover:bg-accent/10",busy===`${conflict.id}:client` && "opacity-60")}><MonitorSmartphone size={11} className="mx-auto mb-0.5"/>Pakai perangkat</button><button type="button" disabled={busy !== null} onClick={() => void resolve(conflict,"merge")} className={clsx("min-h-9 rounded-xl border border-success/20 bg-success/5 px-2 text-[9px] font-semibold text-success transition hover:bg-success/10",busy===`${conflict.id}:merge` && "opacity-60")} title="Pertahankan field yang hanya berubah di satu sisi"><GitMerge size={11} className="mx-auto mb-0.5"/>Gabungkan aman</button><button type="button" disabled={busy !== null} onClick={() => void resolve(conflict,"discard")} className={clsx("min-h-9 rounded-xl border border-danger/15 bg-danger/5 px-2 text-[9px] font-semibold text-danger transition hover:bg-danger/10",busy===`${conflict.id}:discard` && "opacity-60")}><Trash2 size={11} className="mx-auto mb-0.5"/>Buang</button></div>
    </article>)}
  </div>;
}
