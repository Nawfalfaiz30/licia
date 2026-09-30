
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Command, Loader2, RotateCcw, ShieldCheck, Sparkles, Wand2, X } from "lucide-react";
import { Card, PrimaryButton, SoftButton, TextInput, notifyToast } from "@/components/ui";

type Action = { tool: string; ok: boolean; label: string };
type PendingBulk = { id: string; expiresAt: string; actions: Array<{ tool: string; arguments: string; preview: string }> };
const presets = [
  "Apa yang perlu saya selesaikan hari ini berdasarkan semua data saya?",
  "Rapikan minggu saya dari agenda, tugas, target, dan project yang aktif.",
  "Cari hal yang tertinggal dan buat recovery plan yang bisa saya jalankan.",
  "Lihat agenda terdekat dan buat tugas atau pengingat yang memang diperlukan.",
];

export default function LifeCommandPage() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [pending, setPending] = useState<PendingBulk | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [mode, setMode] = useState("operator");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("licia-default-ai-mode");
      if (saved) setMode(saved);
    } catch {}
  }, []);

  async function run(command = input) {
    const text = command.trim();
    if (!text || busy) return;
    setBusy(true);
    setReply("");
    setActions([]);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: [], clientNowIso: new Date().toISOString(), mode, responseStyle: "normal" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Perintah belum berhasil.");
      setReply(String(data.reply || "Tidak ada ringkasan yang bisa ditampilkan."));
      setActions(Array.isArray(data.actions) ? data.actions : []);
      setPending(data.pendingBulkAction && typeof data.pendingBulkAction === "object" ? data.pendingBulkAction : null);
      setUndoId(typeof data.undoActionId === "string" ? data.undoActionId : null);
      setInput("");
      if (Array.isArray(data.actions) && data.actions.some((x: Action) => x.ok)) notifyToast({ title: "Licia menyelesaikan aksi", message: data.actions.filter((x: Action) => x.ok).map((x: Action) => x.label).slice(0, 3).join(" • "), tone: "success" });
    } catch (error) {
      setReply(error instanceof Error ? error.message : "Perintah belum berhasil.");
      notifyToast({ title: "Perintah belum berhasil", message: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally { setBusy(false); }
  }

  async function applyPending() {
    if (!pending || applying) return;
    setApplying(true);
    try {
      const response = await fetch("/api/ai/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingId: pending.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Aksi belum dapat diterapkan.");
      setPending(null); setActions(Array.isArray(data.actions) ? data.actions : []); setUndoId(typeof data.undoActionId === "string" ? data.undoActionId : null);
      notifyToast({ title: "Rencana diterapkan", message: data.partial ? "Sebagian aksi berhasil." : "Semua aksi yang disetujui berhasil.", tone: data.partial ? "warning" : "success" });
    } catch (error) { notifyToast({ title: "Belum berhasil", message: error instanceof Error ? error.message : undefined, tone: "error" }); }
    finally { setApplying(false); }
  }

  async function cancelPending() { if (!pending) return; await fetch("/api/ai/batch", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingId: pending.id }) }).catch(() => undefined); setPending(null); }

  async function undo() {
    if (!undoId || undoing) return;
    setUndoing(true);
    try {
      const response = await fetch("/api/ai/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: undoId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Belum bisa membatalkan aksi.");
      setUndoId(null); notifyToast({ title: "Aksi dibatalkan", message: "Perubahan terakhir dikembalikan.", tone: "success" });
    } catch (error) { notifyToast({ title: "Undo gagal", message: error instanceof Error ? error.message : undefined, tone: "error" }); }
    finally { setUndoing(false); }
  }

  return <div className="space-y-6 animate-licia-page-in">
    <header className="life-command-hero rounded-[2rem] border border-accent/15 bg-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0"><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-accent"><Command size={13}/> Life Command</div><h1 className="font-display text-3xl text-text sm:text-4xl">Satu tempat untuk menyuruh Licia mengerjakan sesuatu.</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-textMuted">Perintah natural language akan membaca konteks Life OS yang relevan, menjalankan aksi yang tersedia, dan meminta persetujuan ketika perubahan berdampak besar.</p></div>
        <Link href="/guide" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-textMuted hover:border-accent/30 hover:text-accent"><ShieldCheck size={14}/> Aturan & Panduan</Link>
      </div>
    </header>

    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">Command composer</p><p className="mt-1 text-xs text-textMuted">Contoh: “jadikan agenda besok sebagai tugas follow-up dan buat pengingat”.</p></div><span className="rounded-full bg-bg px-2.5 py-1 text-[10px] font-semibold text-textMuted">Mode: {mode}</span></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void run(); } }} rows={3} placeholder="Apa yang ingin Licia kerjakan?" className="min-h-28 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent/35"/><PrimaryButton disabled={!input.trim() || busy} onClick={() => void run()} className="sm:min-w-36">{busy ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>} Jalankan</PrimaryButton></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{presets.map((preset) => <button key={preset} onClick={() => void run(preset)} className="min-w-0 rounded-2xl border border-border bg-bg p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/25"><p className="break-words text-xs font-semibold text-text">{preset}</p><span className="mt-1 flex items-center gap-1 text-[10px] text-textMuted">Gunakan contoh <ArrowRight size={11}/></span></button>)}</div>
    </Card>

    {(reply || actions.length > 0 || pending || undoId) && <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><Sparkles size={16}/></span><div><p className="text-sm font-semibold text-text">Hasil Licia</p><p className="text-[10px] text-textMuted">Ringkasan dari data dan aksi yang benar-benar dijalankan.</p></div></div><div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-text">{reply || "Aksi selesai."}</div>{undoId && <button onClick={() => void undo()} disabled={undoing} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 text-xs font-semibold text-accent">{undoing ? <Loader2 size={13} className="animate-spin"/> : <RotateCcw size={13}/>} Batalkan perubahan</button>}</Card>
      <Card className="p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-textMuted">Action trail</p><div className="mt-3 space-y-2">{actions.length ? actions.map((action, index) => <div key={`${action.tool}-${index}`} className="flex min-w-0 items-start gap-2 rounded-2xl border border-border bg-bg p-3 animate-licia-action-burst"><span className={action.ok?"text-success":"text-danger"}>{action.ok?<Check size={14}/>:<X size={14}/>}</span><span className="min-w-0 break-words text-xs font-semibold text-text">{action.label}</span></div>) : <p className="text-xs text-textMuted">Belum ada aksi langsung.</p>}</div></Card>
    </section>}

    {pending && <Card className="border-accent/25 bg-accent/5 p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">Review sebelum jalan</p><h2 className="mt-1 font-display text-xl text-text">Licia menyiapkan {pending.actions.length} perubahan.</h2><div className="mt-3 space-y-2">{pending.actions.map((action, index) => <div key={`${action.tool}-${index}`} className="rounded-2xl border border-border bg-surface p-3"><p className="break-words text-xs font-semibold text-text">{action.preview}</p></div>)}</div></div><div className="flex shrink-0 flex-wrap gap-2"><SoftButton onClick={() => void cancelPending()}>Batalkan</SoftButton><PrimaryButton onClick={() => void applyPending()} disabled={applying}>{applying ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>} Setujui</PrimaryButton></div></div></Card>}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      ["/today","Hari Ini","Lihat konteks paling relevan hari ini."],["/tasks","Tugas","Eksekusi tindakan konkret."],["/calendar","Kalender","Kelola waktu dan agenda."],["/memory","Memori","Lihat apa yang sengaja diingat Licia."]
    ].map(([href,title,desc]) => <Link key={href} href={href} className="group rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-1 hover:border-accent/30"><p className="text-sm font-semibold text-text">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{desc}</p><ArrowRight size={13} className="mt-3 text-textMuted transition group-hover:translate-x-1 group-hover:text-accent"/></Link>)}</div>
  </div>;
}
