"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Check, Clock3, Plus, RefreshCw, Trash2, X, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SoftButton, TextInput, notifyToast } from "@/components/ui";
import { ensureTimezoneOffset } from "@/lib/date";

type Reminder = {
  id: string;
  title: string;
  body: string | null;
  remind_at: string;
  timezone: string;
  target_type: string;
  target_id: string | null;
  offset_minutes: number | null;
  enabled: boolean;
  status: string;
  sent_at: string | null;
  last_attempt_at: string | null;
  delivery_attempts: number;
  last_error: string | null;
  created_at: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isoInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

const ACTIVE_STATUSES = ["pending", "waiting_for_device", "failed", "processing"];

export default function RemindersPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [form, setForm] = useState({ title: "", body: "", when: isoInput(new Date(Date.now() + 30 * 60000)) });
  const [busy, setBusy] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data, error }] = await Promise.all([
        supabase.from("users").select("timezone").eq("id", user.id).single(),
        supabase
          .from("reminders")
          .select("id,title,body,remind_at,timezone,target_type,target_id,offset_minutes,enabled,status,sent_at,last_attempt_at,delivery_attempts,last_error,created_at")
          .eq("user_id", user.id)
          .order("remind_at", { ascending: true })
          .limit(150),
      ]);
      if (error) throw error;
      setTimezone(profile?.timezone || "Asia/Jakarta");
      setRows((data as Reminder[]) || []);
    } catch (e) {
      if (!quiet) notifyToast({ title: "Pengingat tidak termuat", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
    let timer: number | undefined;
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const poll = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void load(true);
    };
    timer = window.setInterval(poll, 30_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", poll);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", poll);
    };
  }, [load]);

  async function add() {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Belum masuk.");
      const remindAt = ensureTimezoneOffset(form.when, timezone);
      if (!remindAt || new Date(remindAt).getTime() < Date.now() - 60_000) throw new Error("Waktu pengingat harus berada di masa depan.");
      const { error } = await supabase.from("reminders").insert({
        user_id: user.id,
        title: form.title.trim().slice(0, 200),
        body: form.body.trim().slice(0, 2000) || null,
        remind_at: remindAt,
        timezone,
        target_type: "custom",
        enabled: true,
        status: "pending",
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setForm({ title: "", body: "", when: isoInput(new Date(Date.now() + 30 * 60000)) });
      setOpen(false);
      await load();
      notifyToast({ title: "Pengingat dibuat", message: `Akan diingatkan pada ${fmt(remindAt)}.`, tone: "success" });
    } catch (e) {
      notifyToast({ title: "Pengingat gagal dibuat", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function runDispatch() {
    setDispatching(true);
    try {
      const res = await fetch("/api/reminders/dispatch?mode=client", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Dispatch gagal.");
      await load();
      notifyToast({
        title: "Reminder engine dijalankan",
        message: `${data.delivered ?? 0} terkirim · ${data.waiting ?? 0} menunggu · ${data.failed ?? 0} gagal.`,
        tone: data.failed ? "error" : "success",
      });
    } catch (e) {
      notifyToast({ title: "Dispatch gagal", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" });
    } finally { setDispatching(false); }
  }

  async function syncDefaults() {
    setSyncing(true);
    try {
      const res = await fetch("/api/reminders/sync-defaults", { method: "POST", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sinkronisasi gagal.");
      await runDispatch();
      await load();
      notifyToast({ title: "Reminder agenda disinkronkan", message: `${data.created ?? 0} reminder baru dibuat untuk data 14 hari ke depan.`, tone: "success" });
    } catch (e) {
      notifyToast({ title: "Sinkronisasi gagal", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" });
    } finally { setSyncing(false); }
  }

  async function updateStatus(id: string, patch: Record<string, unknown>, successTitle: string) {
    setActionId(id);
    try {
      const { error } = await supabase.from("reminders").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await load(true);
      notifyToast({ title: successTitle, message: "Status pengingat diperbarui.", tone: "success" });
    } catch (e) {
      notifyToast({ title: "Perubahan gagal", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" });
    } finally { setActionId(null); }
  }

  async function cancel(id: string) {
    await updateStatus(id, { enabled: false, status: "cancelled", last_error: null }, "Pengingat dibatalkan");
  }

  async function retry(id: string) {
    await updateStatus(id, { enabled: true, status: "pending", last_error: null }, "Pengingat dijadwalkan ulang");
  }

  async function remove(id: string) {
    setActionId(id);
    try {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
      await load(true);
    } catch (e) {
      notifyToast({ title: "Gagal menghapus", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" });
    } finally { setActionId(null); }
  }

  const upcoming = useMemo(() => rows.filter((x) => x.enabled && ACTIVE_STATUSES.includes(x.status)), [rows]);
  const failed = useMemo(() => upcoming.filter((x) => x.status === "failed"), [upcoming]);
  const waiting = useMemo(() => upcoming.filter((x) => x.status === "waiting_for_device"), [upcoming]);
  const overdue = useMemo(() => upcoming.filter((x) => new Date(x.remind_at).getTime() <= Date.now()), [upcoming]);
  const past = useMemo(() => rows.filter((x) => !upcoming.some((y) => y.id === x.id)), [rows, upcoming]);

  return <div className="space-y-6 animate-licia-in">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-accent"><Bell size={14}/> REMINDER ENGINE V30</p>
        <h1 className="mt-1 font-display text-3xl text-text">Pengingat</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-textMuted">Satu engine untuk pengingat manual, agenda, dan aksi AI. Status delivery serta error server dapat dilacak dari sini.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SoftButton onClick={()=>void syncDefaults()} disabled={syncing}>{syncing?<RefreshCw size={13} className="animate-spin"/>:<RefreshCw size={13}/>} Sinkronkan agenda</SoftButton>
        <SoftButton onClick={()=>void runDispatch()} disabled={dispatching}>{dispatching?<RefreshCw size={13} className="animate-spin"/>:<Zap size={13}/>} Jalankan sekarang</SoftButton>
        <SoftButton onClick={()=>void load()} disabled={loading}><RefreshCw size={13} className={loading?"animate-spin":""}/> Segarkan</SoftButton>
        <PrimaryButton onClick={()=>setOpen(v=>!v)}><Plus size={15}/> Pengingat baru</PrimaryButton>
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-4">
      <Card className="p-4"><p className="text-xs text-textMuted">Menunggu</p><p className="mt-1 font-display text-2xl text-accent">{upcoming.length}</p></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">Jatuh tempo</p><p className="mt-1 font-display text-2xl text-text">{overdue.length}</p></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">Perlu perangkat</p><p className="mt-1 font-display text-2xl text-text">{waiting.length}</p></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">Gagal</p><p className="mt-1 font-display text-2xl text-danger">{failed.length}</p></Card>
    </div>

    {failed.length > 0 && <Card className="border-danger/15 bg-danger/5 p-4"><div className="flex gap-3"><span className="rounded-xl bg-danger/10 p-2 text-danger"><AlertTriangle size={15}/></span><div><p className="text-sm font-semibold text-text">Ada pengingat yang gagal dikirim</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Periksa error delivery di kartu pengingat atau gunakan tombol jadwalkan ulang. Worker akan mencoba kembali pada dispatch berikutnya setelah status pending.</p></div></div></Card>}

    {open&&<Card className="border-accent/20 bg-accent/5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-text">Buat pengingat</p><p className="mt-1 text-[10px] text-textMuted">Timezone akun: {timezone}</p></div><button onClick={()=>setOpen(false)} className="rounded-lg p-2 text-textMuted hover:bg-surface" aria-label="Tutup"><X size={14}/></button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><TextInput value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Contoh: Berangkat ke kampus"/><TextInput value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Catatan: urus akademik dulu"/><label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Waktu</span><input type="datetime-local" value={form.when} onChange={e=>setForm({...form,when:e.target.value})} className="field-v27 mt-1 w-full"/></label></div><div className="mt-3 flex justify-end"><PrimaryButton onClick={()=>void add()} disabled={busy}>{busy?<RefreshCw size={14} className="animate-spin"/>:<Check size={14}/>} {busy?"Menyimpan…":"Simpan pengingat"}</PrimaryButton></div></Card>}

    <section><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl text-text">Akan datang</h2><span className="text-[10px] text-textMuted">{upcoming.length} aktif</span></div>{loading?<Card className="p-8 text-center"><RefreshCw size={18} className="mx-auto animate-spin text-accent"/></Card>:!upcoming.length?<EmptyState title="Belum ada pengingat aktif" description="Buat satu pengingat manual atau minta Licia mengaturnya dari chat."/>:<div className="grid gap-3 lg:grid-cols-2">{upcoming.map(r=><Card key={r.id} className="min-w-0 p-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Clock3 size={16}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="break-words text-sm font-semibold text-text">{r.title}</p>{r.status==="failed"&&<span className="rounded-full bg-danger/10 px-2 py-0.5 text-[9px] font-semibold text-danger">Gagal</span>}{r.status==="waiting_for_device"&&<span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-semibold text-accent">Menunggu perangkat</span>}{new Date(r.remind_at).getTime()<=Date.now()&&r.status!=="sent"&&<span className="rounded-full bg-danger/10 px-2 py-0.5 text-[9px] font-semibold text-danger">Jatuh tempo</span>}</div><p className="mt-1 text-xs text-accent">{fmt(r.remind_at)}</p>{r.body&&<p className="mt-2 break-words text-[11px] leading-relaxed text-textMuted">{r.body}</p>}<div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-bg px-2 py-1 text-[9px] text-textMuted">{r.target_type}</span>{r.offset_minutes!=null&&<span className="rounded-full bg-bg px-2 py-1 text-[9px] text-textMuted">H-{r.offset_minutes} menit</span>}<span className="rounded-full bg-bg px-2 py-1 text-[9px] text-textMuted">Percobaan {r.delivery_attempts||0}</span></div>{r.last_error&&<p className="mt-2 break-words rounded-lg bg-danger/5 px-2.5 py-2 text-[9px] leading-relaxed text-danger">{r.last_error}</p>}</div><div className="flex shrink-0 flex-col gap-1">{r.status==="failed"&&<button disabled={actionId===r.id} onClick={()=>void retry(r.id)} className="rounded-lg border border-border p-2 text-textMuted hover:text-accent disabled:opacity-50" title="Jadwalkan ulang"><RefreshCw size={13}/></button>}<button disabled={actionId===r.id} onClick={()=>void cancel(r.id)} className="rounded-lg border border-border p-2 text-textMuted hover:text-accent disabled:opacity-50" title="Batalkan"><Bell size={13}/></button><button disabled={actionId===r.id} onClick={()=>void remove(r.id)} className="rounded-lg p-2 text-textMuted hover:text-danger disabled:opacity-50" title="Hapus"><Trash2 size={13}/></button></div></div></Card>)}</div>}</section>

    {past.length>0&&<section><h2 className="mb-3 font-display text-xl text-text">Riwayat</h2><div className="grid gap-2">{past.slice(0,30).map(r=><div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="break-words text-xs font-semibold text-text">{r.title}</p><span className="rounded-full bg-bg px-2 py-0.5 text-[9px] text-textMuted">{r.status}</span></div><p className="mt-1 text-[9px] text-textMuted">{fmt(r.remind_at)} · percobaan {r.delivery_attempts||0}</p>{r.last_error&&<p className="mt-1 break-words text-[9px] text-danger">{r.last_error}</p>}</div><button disabled={actionId===r.id} onClick={()=>void remove(r.id)} className="rounded-lg p-2 text-textMuted hover:text-danger disabled:opacity-50" aria-label="Hapus riwayat"><Trash2 size={13}/></button></div>)}</div></section>}
  </div>;
}
