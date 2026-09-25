"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, CirclePlay, Clock3, Lightbulb, Plus, Trash2, Zap, Sparkles, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SectionTitle, TextInput } from "@/components/ui";

type Rule = {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: any;
  action_type: string;
  enabled: boolean;
  last_run_at: string | null;
  last_result: string | null;
};
type Task = { id: string; title: string; status: string; due_at: string | null; updated_at: string };
type Decision = { id: string; title: string; review_date: string | null; outcome: string | null };
type Project = { id: string; name: string; updated_at: string; status: string };
type Template = [string, string, string, string, number];

const triggers = [
  { v: "overdue_task", l: "Tugas lewat deadline", help: "Licia mencari tugas terbuka yang tanggalnya sudah lewat." },
  { v: "review_due", l: "Keputusan perlu direview", help: "Licia melihat Decision Journal yang belum punya outcome." },
  { v: "daily_open", l: "Saat Hari Ini dibuka", help: "Cocok untuk pengingat ringan yang selalu muncul saat memulai hari." },
  { v: "inactivity", l: "Proyek lama tidak disentuh", help: "Mendeteksi project aktif yang lama tidak diubah." },
  { v: "schedule_soon", l: "Agenda segera dimulai", help: "Mengingatkan saat agenda tertentu masuk ke jendela menit yang kamu tentukan." },
] as const;

const actions = [
  { v: "notify", l: "Buat pengingat", help: "Hanya memberi tahu atau memberi saran." },
  { v: "suggest_focus", l: "Tawarkan Fokus", help: "Mengarahkannya ke sesi fokus." },
  { v: "open_brief", l: "Tampilkan Brief", help: "Membawa perhatian ke Brief & Review." },
] as const;

const templates: Template[] = [
  ["Tugas terlambat", "Kalau ada tugas lewat deadline", "overdue_task", "notify", 1],
  ["Proyek stagnan", "Kalau proyek tidak disentuh 5 hari", "inactivity", "notify", 5],
  ["Review keputusan", "Saat keputusan perlu ditinjau", "review_due", "open_brief", 1],
  ["Mulai dengan fokus", "Saat Hari Ini dibuka", "daily_open", "suggest_focus", 1],
];

export default function AutomationsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Rule[]>([]);
  const [runningAll, setRunningAll] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({ name: "", trigger_type: "overdue_task", action_type: "notify", days: "3" });
  const [open, setOpen] = useState(false);
  const [runNote, setRunNote] = useState("");

  async function load() {
    const [{ data: r }, { data: t }, { data: d }, { data: p }] = await Promise.all([
      supabase.from("automations").select("id,name,trigger_type,trigger_config,action_type,enabled,last_run_at,last_result").order("created_at", { ascending: false }),
      supabase.from("tasks").select("id,title,status,due_at,updated_at").neq("status", "done").limit(300),
      supabase.from("decisions").select("id,title,review_date,outcome").order("review_date", { ascending: true, nullsFirst: false }).limit(300),
      supabase.from("projects").select("id,name,status,updated_at").in("status", ["active", "paused"]).limit(200),
    ]);
    setRows((r as Rule[]) ?? []);
    setTasks((t as Task[]) ?? []);
    setDecisions((d as Decision[]) ?? []);
    setProjects((p as Project[]) ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function uid() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Belum masuk");
    return user.id;
  }

  async function add() {
    if (!form.name.trim()) return;
    await supabase.from("automations").insert({
      user_id: await uid(),
      name: form.name.trim(),
      trigger_type: form.trigger_type,
      trigger_config: { days: Math.max(1, Number(form.days) || 3), ...(form.trigger_type === "schedule_soon" ? { minutes: Math.min(240, Math.max(5, Number(form.days) || 30)) } : {}) },
      action_type: form.action_type,
      action_config: {},
      enabled: true,
    });
    setForm({ name: "", trigger_type: "overdue_task", action_type: "notify", days: "3" });
    setOpen(false);
    await load();
  }

  async function addTemplate(template: Template) {
    const [name, _help, trigger, action, days] = template;
    await supabase.from("automations").insert({
      user_id: await uid(),
      name,
      trigger_type: trigger,
      trigger_config: { days: Number(days) },
      action_type: action,
      action_config: {},
      enabled: true,
    });
    setRunNote(`Template “${name}” ditambahkan.`);
    await load();
  }

  async function toggle(rule: Rule) {
    await supabase.from("automations").update({ enabled: !rule.enabled, updated_at: new Date().toISOString() }).eq("id", rule.id);
    await load();
  }

  async function remove(id: string) {
    await supabase.from("automations").delete().eq("id", id);
    await load();
  }

  const overdue = useMemo(() => tasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now()), [tasks]);
  const dueReviews = useMemo(() => decisions.filter((d) => d.review_date && !d.outcome && new Date(`${d.review_date}T23:59:59`).getTime() <= Date.now()), [decisions]);
  const staleProjects = useMemo(() => projects.filter((p) => Date.now() - new Date(p.updated_at).getTime() > 3 * 86400000), [projects]);

  async function runAll() {
    setRunningAll(true);
    try {
      const res = await fetch("/api/automations/evaluate", { method: "GET", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setRunNote(res.ok ? `Evaluasi selesai. ${data.matched?.length ?? 0} aturan menemukan kondisi yang cocok.` : "Evaluasi otomatisasi gagal dijalankan.");
      await load();
    } catch {
      setRunNote("Evaluasi otomatisasi tidak dapat dijalankan sekarang.");
    } finally {
      setRunningAll(false);
    }
  }

  async function testRule(rule: Rule) {
    let matched = 0;
    let detail = "";
    const days = Math.max(1, Number(rule.trigger_config?.days) || 3);
    if (rule.trigger_type === "overdue_task") {
      matched = overdue.length;
      detail = matched ? `${matched} tugas terlambat` : "tidak ada tugas terlambat";
    } else if (rule.trigger_type === "review_due") {
      matched = dueReviews.length;
      detail = matched ? `${matched} keputusan butuh review` : "belum ada keputusan yang jatuh tempo";
    } else if (rule.trigger_type === "daily_open") {
      matched = 1;
      detail = "aturan siap dipakai saat Hari Ini dibuka";
    } else if (rule.trigger_type === "schedule_soon") {
      detail = "Pengingat agenda dievaluasi oleh server saat automation dijalankan.";
      matched = 1;
    } else {
      matched = projects.filter((p) => Date.now() - new Date(p.updated_at).getTime() > days * 86400000).length;
      detail = matched ? `${matched} proyek tidak disentuh > ${days} hari` : "semua project masih aktif disentuh";
    }
    const resultText = matched > 0 ? `Terpenuhi · ${detail}` : `Belum terpenuhi · ${detail}`;
    await supabase.from("automations").update({ last_run_at: new Date().toISOString(), last_result: resultText }).eq("id", rule.id);
    setRunNote(`${rule.name}: ${detail}. Aksi “${actions.find((a) => a.v === rule.action_type)?.l || rule.action_type}” aman dan tidak mengubah data diam-diam.`);
    await load();
  }

  return (
    <div className="space-y-7 animate-licia-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent"><Zap size={14} /> LAPISAN PROAKTIF</p>
          <h1 className="font-display text-3xl text-text">Pusat Otomatisasi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-textMuted">Otomatisasi adalah aturan kecil untuk membuat Licia lebih proaktif: ketika kondisi tertentu muncul, aplikasi dapat menyiapkan pengingat atau menawarkan langkah berikutnya.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={runAll} disabled={runningAll} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs font-semibold text-textMuted transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:opacity-60"><RefreshCw size={14} className={runningAll ? "animate-spin" : ""} /> {runningAll ? "Mengevaluasi…" : "Jalankan sekarang"}</button>
          <PrimaryButton onClick={() => setOpen((v) => !v)}><Plus size={16} /> Aturan baru</PrimaryButton>
        </div>
      </header>

      <Card className="border-accent/20 bg-accent/5">
        <div className="flex gap-3"><Lightbulb size={19} className="mt-0.5 shrink-0 text-accent" /><div><p className="text-sm font-semibold text-text">Jadi, ini sebenarnya untuk apa?</p><p className="mt-1 text-xs leading-relaxed text-textMuted">Contoh: “kalau tugas lewat deadline, beri tahu saya”; “kalau proyek tidak disentuh 5 hari, ingatkan”; atau “saat mulai hari, tawarkan Fokus”. Kamu tetap memegang keputusan.</p></div></div>
      </Card>

      {runNote && <Card className="border-accent/20"><div className="flex gap-2"><BellRing size={17} className="mt-0.5 shrink-0 text-accent" /><p className="text-xs leading-relaxed text-text">{runNote}</p></div></Card>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-textMuted">Aturan aktif</p><p className="mt-1 font-display text-2xl text-accent">{rows.filter((r) => r.enabled).length}</p></Card>
        <Card className="p-4"><p className="text-xs text-textMuted">Terlambat</p><p className="mt-1 font-display text-2xl text-danger">{overdue.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-textMuted">Review jatuh tempo</p><p className="mt-1 font-display text-2xl text-text">{dueReviews.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-textMuted">Proyek lama</p><p className="mt-1 font-display text-2xl text-accent">{staleProjects.length}</p></Card>
      </div>

      {open && <Card>
        <SectionTitle>Bangun aturanmu</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama aturan · mis. Follow-up project lama" />
          <select value={form.trigger_type} onChange={(e) => setForm({ ...form, trigger_type: e.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text">{triggers.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          <select value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text">{actions.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select>
          <TextInput type="number" min="1" max="240" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} placeholder={form.trigger_type === "schedule_soon" ? "Menit sebelum agenda · mis. 30" : "Ambang hari · untuk project inactivity"} />
        </div>
        <div className="mt-3 rounded-xl bg-bg p-3 text-xs leading-relaxed text-textMuted">Trigger: <strong className="text-text">{triggers.find((t) => t.v === form.trigger_type)?.help}</strong><br />Aksi: <strong className="text-text">{actions.find((a) => a.v === form.action_type)?.help}</strong></div>
        <div className="mt-3 flex justify-end"><PrimaryButton onClick={add}><Check size={15} /> Simpan aturan</PrimaryButton></div>
      </Card>}

      <Card>
        <SectionTitle><span className="flex items-center gap-2"><Sparkles size={16} className="text-accent" /> Template yang bisa langsung dipakai</span></SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map(([name, help, trigger, action, days]) => (
            <button key={name} onClick={() => void addTemplate([name, help, trigger, action, days])} className="rounded-xl border border-border bg-bg p-3 text-left transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-sm"><p className="text-xs font-semibold text-text">{name}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{help}</p></button>
          ))}
        </div>
      </Card>

      {!rows.length ? <EmptyState title="Belum ada automation" description="Mulai dari satu aturan sederhana; kamu tidak perlu membuat banyak aturan sekaligus." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((rule) => (
            <Card key={rule.id} className={clsx("min-w-0", !rule.enabled && "opacity-60")}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-accent/10 p-2 text-accent"><CirclePlay size={17} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="break-words text-sm font-semibold text-text">{rule.name}</p><span className="rounded-full bg-bg px-2 py-1 text-[10px] text-textMuted">{rule.enabled ? "Aktif" : "Mati"}</span></div>
                  <p className="mt-2 text-xs text-textMuted">{triggers.find((x) => x.v === rule.trigger_type)?.l || rule.trigger_type}</p>
                  <p className="mt-1 text-xs text-text">→ {actions.find((x) => x.v === rule.action_type)?.l || rule.action_type}</p>
                  {rule.last_run_at && <p className="mt-2 flex items-center gap-1 text-[10px] text-textMuted"><Clock3 size={11} /> Dicek {new Date(rule.last_run_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{rule.last_result ? ` · ${rule.last_result}` : ""}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => void toggle(rule)} className="rounded-lg border border-border px-2 py-1.5 text-[10px] text-textMuted hover:text-accent">{rule.enabled ? "Matikan" : "Aktifkan"}</button>
                  <button onClick={() => void testRule(rule)} className="rounded-lg border border-border p-2 text-textMuted hover:text-accent" title="Cek sekarang"><BellRing size={14} /></button>
                  <button onClick={() => void remove(rule.id)} className="rounded-lg p-2 text-textMuted hover:text-danger" title="Hapus"><Trash2 size={14} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
