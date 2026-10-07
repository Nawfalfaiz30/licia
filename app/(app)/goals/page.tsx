"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Flag,
  FolderKanban,
  Gauge,
  Plus,
  Search,
  Sparkles,
  Target as TargetIcon,
  Trash2,
  CalendarDays,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SoftButton, TextInput } from "@/components/ui";
import { mutateEntity } from "@/lib/sync/client";

import { useLanguage } from "@/components/LanguageProvider";
import { documentLocale } from "@/lib/format";
type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  progress: number;
  status: string;
  category: string | null;
  why: string | null;
  next_step: string | null;
  review_cycle: string | null;
  area_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  version?: number;
};
type Milestone = {
  id: string;
  goal_id: string;
  title: string;
  status: string;
  target_date: string | null;
  position: number;
  version?: number;
};
type Project = { id: string; name: string; goal_id: string | null; status: string; target_date: string | null };
type Task = { id: string; title: string; status: string; project_id: string | null };
type Area = { id: string; name: string };
function remaining(v: string | null) {
  if (!v) return null;
  return Math.ceil((new Date(`${v}T23:59:59`).getTime() - Date.now()) / 86400000);
}
function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}
function dateLabel(v: string | null) {
  if (!v) return "Tanpa target";
  return new Date(`${v}T12:00:00`).toLocaleDateString(documentLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function reviewDays(goal: Goal) {
  if (!goal.review_cycle || !goal.updated_at) return null;
  const days = goal.review_cycle === "weekly" ? 7 : goal.review_cycle === "monthly" ? 30 : 90;
  return Math.ceil((new Date(goal.updated_at).getTime() + days * 86400000 - Date.now()) / 86400000);
}
function progressTone(goal: Goal) {
  const d = remaining(goal.target_date);
  if (goal.status === "achieved") return "success";
  if (d !== null && d < 0 && goal.progress < 100) return "danger";
  if (d !== null && d <= 14 && goal.progress < 75) return "warning";
  return "accent";
}

export default function GoalsPage() {
  const { t: tr, locale } = useLanguage();
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const [mForm, setMForm] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "",
    category: "",
    target: "",
    why: "",
    next: "",
    description: "",
    review: "weekly",
    area: "",
  });
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const [{ data: g }, { data: m }, { data: p }, { data: t }, { data: a }] = await Promise.all([
      supabase
        .from("goals")
        .select(
          "id,title,description,target_date,progress,status,category,why,next_step,review_cycle,area_id,created_at,updated_at,version",
        )
        .neq("status", "abandoned")
        .order("updated_at", { ascending: false }),
      supabase
        .from("goal_milestones")
        .select("id,goal_id,title,status,target_date,position,version")
        .order("position")
        .order("created_at"),
      supabase.from("projects").select("id,name,goal_id,status,target_date").neq("status", "archived"),
      supabase.from("tasks").select("id,title,status,project_id").neq("status", "done").limit(700),
      supabase.from("areas").select("id,name").order("created_at"),
    ]);
    setGoals((g as Goal[]) || []);
    setMilestones((m as Milestone[]) || []);
    setProjects((p as Project[]) || []);
    setTasks((t as Task[]) || []);
    setAreas((a as Area[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  async function uid() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error(tr("Belum masuk"));
    return user.id;
  }
  async function add() {
    if (!form.title.trim()) return;
    await mutateEntity({
      entityType: "goal",
      operation: "create",
      payload: {
        title: form.title.trim(),
        category: form.category.trim() || null,
        target_date: form.target || null,
        why: form.why.trim() || null,
        next_step: form.next.trim() || null,
        description: form.description.trim() || null,
        status: "active",
        progress: 0,
        review_cycle: form.review,
        area_id: form.area || null,
      },
    });
    setForm({ title: "", category: "", target: "", why: "", next: "", description: "", review: "weekly", area: "" });
    setOpenForm(false);
    await load();
  }
  async function updateProgress(g: Goal, progress: number) {
    await mutateEntity({
      entityType: "goal",
      operation: "update",
      entityId: g.id,
      baseVersion: g.version ?? null,
      clientUpdatedAt: g.updated_at,
      payload: { progress: clamp(progress), status: progress >= 100 ? "achieved" : "active" },
    });
    await load();
  }
  async function syncMilestones(g: Goal) {
    const ms = milestones.filter((m) => m.goal_id === g.id);
    if (!ms.length) return;
    const done = ms.filter((m) => m.status === "done").length;
    await updateProgress(g, Math.round((done / ms.length) * 100));
  }
  async function remove(id: string) {
    const g = goals.find((x) => x.id === id);
    await mutateEntity({
      entityType: "goal",
      operation: "update",
      entityId: id,
      baseVersion: g?.version ?? null,
      clientUpdatedAt: g?.updated_at,
      payload: { status: "abandoned" },
    });
    await load();
  }
  async function addMilestone(gid: string) {
    const title = (mForm[gid] || "").trim();
    if (!title) return;
    await mutateEntity({
      entityType: "milestone",
      operation: "create",
      payload: { goal_id: gid, title, status: "todo", position: milestones.filter((m) => m.goal_id === gid).length },
    });
    setMForm((v) => ({ ...v, [gid]: "" }));
    await load();
  }
  async function toggleM(m: Milestone) {
    await mutateEntity({
      entityType: "milestone",
      operation: "update",
      entityId: m.id,
      baseVersion: m.version ?? null,
      payload: { status: m.status === "done" ? "todo" : "done" },
    });
    await load();
  }
  async function setMilestoneDate(m: Milestone, value: string) {
    await mutateEntity({
      entityType: "milestone",
      operation: "update",
      entityId: m.id,
      baseVersion: m.version ?? null,
      payload: { target_date: value || null },
    });
    await load();
  }
  const active = goals.filter((g) => g.status === "active");
  const reviewDue = active.filter((g) => (reviewDays(g) ?? 999) > 0 && (reviewDays(g) ?? 999) <= 3).length;
  const achieved = goals.filter((g) => g.status === "achieved");
  const dueSoon = active.filter((g) => {
    const d = remaining(g.target_date);
    return d !== null && d >= 0 && d <= 14;
  });
  const overdue = active.filter((g) => {
    const d = remaining(g.target_date);
    return d !== null && d < 0;
  });
  const avg = active.length ? Math.round(active.reduce((s, g) => s + Number(g.progress || 0), 0) / active.length) : 0;
  const categoryList = ["all", ...Array.from(new Set(goals.map((g) => g.category).filter(Boolean) as string[]))];
  const filtered = useMemo(
    () =>
      goals.filter((g) => {
        const statusOk = status === "all" || g.status === status;
        const catOk = category === "all" || g.category === category;
        const qOk =
          !query.trim() ||
          `${g.title} ${g.description || ""} ${g.next_step || ""} ${g.category || ""}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return statusOk && catOk && qOk;
      }),
    [goals, status, category, query],
  );
  const categoryStats = useMemo(
    () =>
      Array.from(new Set(goals.map((g) => g.category || "Tanpa kategori")))
        .map((name) => {
          const rows = goals.filter((g) => (g.category || "Tanpa kategori") == name);
          return {
            name,
            count: rows.length,
            progress: Math.round(rows.reduce((s, g) => s + Number(g.progress || 0), 0) / Math.max(1, rows.length)),
          };
        })
        .sort((a, b) => b.count - a.count),
    [goals],
  );
  if (loading)
    return (
      <div className="space-y-4 animate-licia-page-in">
        <Card className="p-5">
          <div className="h-8 w-1/2 animate-licia-shimmer rounded-xl bg-bg" />
          <div className="mt-3 h-24 animate-licia-shimmer rounded-2xl bg-bg" />
        </Card>
      </div>
    );
  return (
    <div className="licia-v33-page-in goals-v27 space-y-5 animate-licia-page-in">
      <header className="goals-v27-hero relative overflow-hidden rounded-[2rem] border border-accent/15 bg-surface p-5 sm:p-7">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-2 text-2xs font-bold uppercase tracking-[.17em] text-accent">
              <Flag size={13} /> {tr("Direction system")}
            </p>
            <h1 className="font-display text-3xl text-text sm:text-4xl">{tr("Target yang bisa dijalankan.")}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-textMuted">
              {tr(
                "Setiap target sekarang punya alasan, horizon waktu, roadmap milestone, koneksi project, tugas terbuka, siklus review, dan langkah berikutnya.",
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => setOpenForm((v) => !v)}>
                <Plus size={15} /> {tr("Target baru")}
              </PrimaryButton>
              <Link
                href="/planner"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg px-4 text-xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
              >
                <Sparkles size={14} /> {tr("Rencanakan dengan AI")}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border bg-bg/75 p-3">
              <p className="text-2xs uppercase tracking-wider text-textMuted">{tr("Rata-rata aktif")}</p>
              <p className="mt-1 font-display text-3xl text-accent">{avg}%</p>
              <p className="mt-1 text-2xs text-textMuted">
                {tr("{active_length} target aktif", { active_length: active.length })}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-bg/75 p-3">
              <p className="text-2xs uppercase tracking-wider text-textMuted">{tr("Perlu perhatian")}</p>
              <p className="mt-1 font-display text-3xl text-text">{overdue.length + dueSoon.length}</p>
              <p className="mt-1 text-2xs text-textMuted">
                {tr("{overdue_length} lewat · {dueSoon_length} dekat", {
                  overdue_length: overdue.length,
                  dueSoon_length: dueSoon.length,
                })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="goal-stat-v27">
          <p className="text-2xs text-textMuted">{tr("Aktif")}</p>
          <p className="mt-1 font-display text-2xl text-accent">{active.length}</p>
        </Card>
        <Card className="goal-stat-v27">
          <p className="text-2xs text-textMuted">{tr("Tercapai")}</p>
          <p className="mt-1 font-display text-2xl text-success">{achieved.length}</p>
        </Card>
        <Card className="goal-stat-v27">
          <p className="text-2xs text-textMuted">{tr("Lewat target")}</p>
          <p className="mt-1 font-display text-2xl text-danger">{overdue.length}</p>
        </Card>
        <Card className="goal-stat-v27">
          <p className="text-2xs text-textMuted">{tr("≤ 14 hari")}</p>
          <p className="mt-1 font-display text-2xl text-accent">{dueSoon.length}</p>
        </Card>
        <Card className="goal-stat-v27">
          <p className="text-2xs text-textMuted">{tr("Punya roadmap")}</p>
          <p className="mt-1 font-display text-2xl text-text">
            {active.filter((g) => milestones.some((m) => m.goal_id === g.id)).length}
          </p>
        </Card>
        <Card className="goal-stat-v27">
          <p className="text-2xs text-textMuted">{tr("Review dekat")}</p>
          <p className="mt-1 font-display text-2xl text-text">{reviewDue}</p>
          <p className="text-2xs text-textMuted">{tr("dalam 3 hari")}</p>
        </Card>
      </section>

      {openForm && (
        <Card className="goal-form-v27 border-accent/20 bg-accent/5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[.15em] text-accent">{tr("Target baru")}</p>
              <h2 className="mt-1 font-display text-xl text-text">{tr("Buat arah yang jelas")}</h2>
            </div>
            <button
              onClick={() => setOpenForm(false)}
              className="touch-target rounded-xl border border-border bg-surface text-textMuted"
              aria-label={tr("Tutup")}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <TextInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={tr("Judul target")}
            />
            <TextInput
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder={tr("Kategori, mis. karier")}
            />
            <input
              type="date"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="field-v27"
            />
            <TextInput
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
              placeholder={tr("Langkah berikutnya")}
            />
            <TextInput
              value={form.why}
              onChange={(e) => setForm({ ...form, why: e.target.value })}
              placeholder={tr("Kenapa ini penting?")}
            />
            <select
              value={form.review}
              onChange={(e) => setForm({ ...form, review: e.target.value })}
              className="field-v27"
            >
              <option value="weekly">{tr("Review mingguan")}</option>
              <option value="monthly">{tr("Review bulanan")}</option>
              <option value="quarterly">{tr("Review triwulan")}</option>
            </select>
            <select
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              className="field-v27"
            >
              <option value="">{tr("Tanpa area")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="min-h-24 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-accent/30 sm:col-span-2 lg:col-span-2"
              placeholder={tr("Definisi selesai, konteks, batasan, atau catatan…")}
            />
          </div>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <SoftButton onClick={() => setOpenForm(false)}>{tr("Batal")}</SoftButton>
            <PrimaryButton onClick={() => void add()} disabled={!form.title.trim()}>
              <Check size={15} /> {tr("Simpan target")}
            </PrimaryButton>
          </div>
        </Card>
      )}

      <section className="rounded-2xl border border-border bg-surface p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-bg px-3">
            <Search size={14} className="shrink-0 text-textMuted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Cari target, langkah, kategori…")}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-text outline-none"
            />
          </div>
          <div className="flex min-w-0 gap-1.5 overflow-x-auto no-scrollbar">
            {[
              ["active", "Aktif"],
              ["achieved", "Tercapai"],
              ["all", "Semua"],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setStatus(v)}
                className={
                  status === v
                    ? "shrink-0 rounded-xl bg-accent px-3 py-2 text-2xs font-semibold text-white"
                    : "shrink-0 rounded-xl bg-bg px-3 py-2 text-2xs font-semibold text-textMuted"
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {categoryList.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={
                category === c
                  ? "shrink-0 rounded-lg bg-accent/10 px-2.5 py-1.5 text-2xs font-semibold text-accent"
                  : "shrink-0 rounded-lg bg-bg px-2.5 py-1.5 text-2xs text-textMuted"
              }
            >
              {c === "all" ? tr("Semua kategori") : c}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[.14em] text-accent">{tr("Portfolio view")}</p>
              <h2 className="mt-1 font-display text-xl text-text">{tr("Peta target")}</h2>
            </div>
            <span className="text-2xs text-textMuted">
              {tr("{filtered_length} tampil", { filtered_length: filtered.length })}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {categoryStats.slice(0, 6).map((x) => (
              <div key={x.name}>
                <div className="flex items-center justify-between gap-2 text-2xs">
                  <span className="truncate font-semibold text-text">{x.name}</span>
                  <span className="text-textMuted">
                    {x.count} · {x.progress}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${x.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Gauge size={17} className="text-accent" />
            <div>
              <p className="text-sm font-semibold text-text">{tr("Koneksi sistem")}</p>
              <p className="text-2xs text-textMuted">
                {tr("Target akan lebih hidup saat terhubung ke project dan task.")}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-bg p-3">
              <p className="text-2xs text-textMuted">{tr("Project terkait")}</p>
              <p className="mt-1 font-display text-xl text-text">{projects.filter((p) => p.goal_id).length}</p>
            </div>
            <div className="rounded-xl bg-bg p-3">
              <p className="text-2xs text-textMuted">{tr("Task di roadmap")}</p>
              <p className="mt-1 font-display text-xl text-text">{tasks.length}</p>
            </div>
            <div className="rounded-xl bg-bg p-3">
              <p className="text-2xs text-textMuted">{tr("Milestone")}</p>
              <p className="mt-1 font-display text-xl text-text">{milestones.length}</p>
            </div>
            <div className="rounded-xl bg-bg p-3">
              <p className="text-2xs text-textMuted">{tr("Selesai")}</p>
              <p className="mt-1 font-display text-xl text-success">
                {milestones.filter((m) => m.status === "done").length}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="goal-insight-v27 p-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-accent">{tr("Momentum")}</p>
          <p className="mt-2 text-sm font-semibold text-text">
            {active.length
              ? tr("{round}% rata-rata progres", {
                  round: Math.round(active.reduce((s, g) => s + Number(g.progress || 0), 0) / active.length),
                })
              : tr("Mulai dari satu target")}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-textMuted">
            {tr("Gunakan milestone sebagai bukti kemajuan, bukan hanya angka progres manual.")}
          </p>
        </Card>
        <Card className="goal-insight-v27 p-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-accent">{tr("Roadmap")}</p>
          <p className="mt-2 text-sm font-semibold text-text">
            {active.filter((g) => milestones.some((m) => m.goal_id === g.id)).length}
            {tr("/{active_length} target punya milestone", { active_length: active.length })}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-textMuted">
            {tr("Target tanpa milestone tetap bisa berjalan, tetapi lebih sulit dipecah menjadi langkah konkret.")}
          </p>
        </Card>
        <Card className="goal-insight-v27 p-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-accent">{tr("Review")}</p>
          <p className="mt-2 text-sm font-semibold text-text">
            {active.filter((g) => g.next_step).length} {tr("target punya next step")}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-textMuted">
            {tr("Setiap target idealnya memiliki satu tindakan berikutnya yang bisa langsung dikerjakan.")}
          </p>
        </Card>
      </section>

      {!filtered.length ? (
        <EmptyState
          title={tr("Tidak ada target yang cocok")}
          description={tr("Ubah filter atau buat target baru agar arah kerjamu punya tempat di sini.")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((g) => {
            const ms = milestones.filter((m) => m.goal_id === g.id);
            const done = ms.filter((m) => m.status === "done").length;
            const linkedProjects = projects.filter((p) => p.goal_id === g.id);
            const ids = new Set(linkedProjects.map((p) => p.id));
            const openTasks = tasks.filter((t) => t.project_id && ids.has(t.project_id));
            const tone = progressTone(g);
            const d = remaining(g.target_date);
            const timeExpected =
              g.target_date && g.created_at
                ? Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round(
                        ((Date.now() - new Date(g.created_at).getTime()) /
                          (new Date(`${g.target_date}T23:59:59`).getTime() - new Date(g.created_at).getTime())) *
                          100,
                      ),
                    ),
                  )
                : null;
            const delta = timeExpected === null ? null : Number(g.progress || 0) - timeExpected;
            return (
              <Card key={g.id} className="goal-card-v27 overflow-hidden p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div
                    className={clsx(
                      "rounded-2xl p-2.5",
                      tone === "danger"
                        ? "bg-danger/10 text-danger"
                        : tone === "warning"
                          ? "bg-accentSoft/10 text-accentSoft"
                          : tone === "success"
                            ? "bg-success/10 text-success"
                            : "bg-accent/10 text-accent",
                    )}
                  >
                    <TargetIcon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-bg px-2 py-1 text-2xs font-semibold text-textMuted">
                        {g.category || "Tanpa kategori"}
                      </span>
                      {g.review_cycle && (
                        <span className="rounded-full bg-bg px-2 py-1 text-2xs text-textMuted">
                          {tr("Review {review_cycle}", { review_cycle: g.review_cycle })}
                        </span>
                      )}
                      {d !== null && (
                        <span
                          className={clsx(
                            "rounded-full px-2 py-1 text-2xs",
                            d < 0
                              ? "bg-danger/10 text-danger"
                              : d <= 14
                                ? "bg-accent/10 text-accent"
                                : "bg-bg text-textMuted",
                          )}
                        >
                          {d < 0 ? tr("{abs} hari lewat", { abs: Math.abs(d) }) : d === 0 ? tr("hari ini") : `H-${d}`}
                        </span>
                      )}
                      {reviewDays(g) !== null && (
                        <span
                          className={clsx(
                            "rounded-full px-2 py-1 text-2xs",
                            (reviewDays(g) ?? 99) <= 0
                              ? "bg-success/10 text-success"
                              : (reviewDays(g) ?? 99) <= 3
                                ? "bg-accentSoft/10 text-accentSoft"
                                : "bg-bg text-textMuted",
                          )}
                        >
                          {(reviewDays(g) ?? 0) <= 0
                            ? tr("Review hari ini")
                            : tr("Review H-{reviewDays}", { reviewDays: reviewDays(g) })}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 break-words font-display text-xl text-text">{g.title}</h3>
                    <p className="mt-1 text-2xs text-textMuted">
                      {g.target_date ? dateLabel(g.target_date) : tr("Belum ada tanggal target")}
                      {g.area_id ? ` · ${areas.find((a) => a.id === g.area_id)?.name || "Area"}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => void remove(g.id)}
                    className="touch-target shrink-0 rounded-lg text-textMuted hover:text-danger"
                    aria-label={tr("Arsipkan {g_title}", { g_title: g.title })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs text-textMuted">{tr("Progres nyata")}</span>
                    <span className="font-display text-lg text-accent">{g.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${clamp(Number(g.progress || 0))}%` }}
                    />
                  </div>
                  {delta !== null && (
                    <p className={clsx("mt-1.5 text-2xs", delta >= 0 ? "text-success" : "text-accentSoft")}>
                      {delta >= 0
                        ? tr("{delta}% di depan ritme waktu teoritis.", { delta })
                        : tr("{abs}% di bawah ritme waktu teoritis.", { abs: Math.abs(delta) })}
                    </p>
                  )}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Milestone")}</p>
                    <p className="mt-1 text-sm font-semibold text-text">
                      {done}/{ms.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Project")}</p>
                    <p className="mt-1 text-sm font-semibold text-text">{linkedProjects.length}</p>
                  </div>
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Task roadmap")}</p>
                    <p className="mt-1 text-sm font-semibold text-text">{openTasks.length}</p>
                  </div>
                </div>
                {g.why && (
                  <div className="mt-3 rounded-xl border border-border bg-bg/60 p-3">
                    <p className="text-2xs font-bold uppercase tracking-wider text-textMuted">{tr("Kenapa")}</p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-text">{g.why}</p>
                  </div>
                )}
                {g.next_step && (
                  <Link
                    href="/tasks"
                    className="mt-3 flex items-start gap-2 rounded-xl border border-accent/15 bg-accent/5 p-3"
                  >
                    <ListChecks size={14} className="mt-0.5 shrink-0 text-accent" />
                    <span className="min-w-0">
                      <span className="block text-2xs font-bold uppercase tracking-wider text-accent">
                        {tr("Next step")}
                      </span>
                      <span className="mt-0.5 block break-words text-xs font-semibold text-text">{g.next_step}</span>
                    </span>
                    <ArrowRight size={13} className="ml-auto mt-0.5 shrink-0 text-accent" />
                  </Link>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void updateProgress(g, g.progress >= 100 ? 0 : g.progress + 5)}
                    className="rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
                  >
                    +5%
                  </button>
                  <button
                    onClick={() => void syncMilestones(g)}
                    disabled={!ms.length}
                    className="rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent disabled:opacity-40"
                  >
                    {tr("Sync milestone")}
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                    className="rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted"
                  >
                    <ChevronDown
                      size={12}
                      className={clsx("mr-1 inline transition", expanded === g.id && "rotate-180")}
                    />
                    {tr("Roadmap")}
                  </button>
                  {linkedProjects[0] && (
                    <Link href="/projects" className="rounded-xl bg-accent px-3 py-2 text-2xs font-semibold text-white">
                      {tr("Buka project")}
                    </Link>
                  )}
                </div>
                {expanded === g.id && (
                  <div className="mt-3 border-t border-border pt-3 animate-licia-pop-in">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-2xs font-bold uppercase tracking-wider text-textMuted">{tr("Milestone")}</p>
                        <p className="mt-0.5 text-2xs text-textMuted">
                          {tr("Tandai selesai atau beri tenggat tengah.")}
                        </p>
                      </div>
                      <span className="rounded-full bg-bg px-2 py-1 text-2xs font-semibold text-textMuted">
                        {done}/{ms.length}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={mForm[g.id] || ""}
                        onChange={(e) => setMForm((v) => ({ ...v, [g.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void addMilestone(g.id);
                        }}
                        placeholder={tr("Tambah milestone…")}
                        className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-xs text-text outline-none focus:ring-2 focus:ring-accent/30"
                      />
                      <button
                        onClick={() => void addMilestone(g.id)}
                        className="touch-target shrink-0 rounded-xl bg-accent px-3 text-white"
                        aria-label={tr("Tambah milestone")}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {!ms.length && (
                      <div className="mt-2 rounded-xl border border-dashed border-border p-4 text-center text-2xs text-textMuted">
                        {tr("Belum ada milestone.")}
                      </div>
                    )}
                    {ms.map((m, index) => (
                      <div key={m.id} className="mt-2 rounded-xl border border-border bg-bg/65 p-3">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => void toggleM(m)}
                            className={clsx(
                              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                              m.status === "done"
                                ? "border-success bg-success/10 text-success"
                                : "border-border text-transparent",
                            )}
                            aria-label={tr("Tandai {m_title}", { m_title: m.title })}
                          >
                            {<Check size={13} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p
                              className={clsx(
                                "break-words text-xs font-semibold",
                                m.status === "done" ? "text-textMuted line-through" : "text-text",
                              )}
                            >
                              {index + 1}. {m.title}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <CalendarDays size={11} className="text-textMuted" />
                              <input
                                type="date"
                                value={m.target_date || ""}
                                onChange={(e) => void setMilestoneDate(m, e.target.value)}
                                className="min-h-8 min-w-0 rounded-lg border border-border bg-surface px-2 text-2xs text-text"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {g.description && (
                  <p className="mt-3 line-clamp-3 break-words text-2xs leading-relaxed text-textMuted">
                    {g.description}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
