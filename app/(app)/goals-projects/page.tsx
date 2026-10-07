"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FolderKanban,
  ListChecks,
  Plus,
  Search,
  Target,
  Timer,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SectionTitle, TextInput } from "@/components/ui";
import { mutateEntity } from "@/lib/sync/client";

import { useLanguage } from "@/components/LanguageProvider";
type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  progress: number;
  status: string;
  category: string | null;
  next_step: string | null;
  updated_at: string | null;
  version?: number;
};
type Project = {
  id: string;
  name: string;
  description: string | null;
  goal_id: string | null;
  status: string;
  target_date: string | null;
  updated_at: string | null;
  version?: number;
};
type Task = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  project_id: string | null;
  estimated_minutes: number | null;
};
type Focus = { task_id: string | null; focus_minutes: number };

function days(v: string | null) {
  if (!v) return null;
  return Math.ceil((new Date(`${v}T23:59:59`).getTime() - Date.now()) / 86400000);
}
function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

export default function GoalsProjectsPage() {
  const { t: tr } = useLanguage();
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusRows, setFocusRows] = useState<Focus[]>([]);
  const [tab, setTab] = useState<"all" | "goals" | "projects">("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<"goal" | "project" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalForm, setGoalForm] = useState({ title: "", target: "", next: "" });
  const [projectForm, setProjectForm] = useState({ name: "", description: "", target: "", goalId: "" });
  const [newTask, setNewTask] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [{ data: g }, { data: p }, { data: t }, { data: f }] = await Promise.all([
      supabase
        .from("goals")
        .select("id,title,description,target_date,progress,status,category,next_step,updated_at,version")
        .neq("status", "abandoned")
        .order("updated_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id,name,description,goal_id,status,target_date,updated_at,version")
        .neq("status", "archived")
        .order("updated_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id,title,status,due_at,project_id,estimated_minutes")
        .order("updated_at", { ascending: false })
        .limit(600),
      supabase.from("pomodoro_sessions").select("task_id,focus_minutes").limit(1200),
    ]);
    setGoals((g as Goal[]) || []);
    setProjects((p as Project[]) || []);
    setTasks((t as Task[]) || []);
    setFocusRows((f as Focus[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function addGoal() {
    if (!goalForm.title.trim()) return;
    await mutateEntity({
      entityType: "goal",
      operation: "create",
      payload: {
        title: goalForm.title.trim(),
        target_date: goalForm.target || null,
        next_step: goalForm.next.trim() || null,
        status: "active",
        progress: 0,
      },
    });
    setGoalForm({ title: "", target: "", next: "" });
    setForm(null);
    await load();
  }
  async function updateGoal(g: Goal, progress: number) {
    await mutateEntity({
      entityType: "goal",
      operation: "update",
      entityId: g.id,
      baseVersion: g.version ?? null,
      clientUpdatedAt: g.updated_at || undefined,
      payload: { progress: clamp(progress), status: progress >= 100 ? "achieved" : "active" },
    });
    await load();
  }
  async function archiveGoal(g: Goal) {
    await mutateEntity({
      entityType: "goal",
      operation: "update",
      entityId: g.id,
      baseVersion: g.version ?? null,
      clientUpdatedAt: g.updated_at || undefined,
      payload: { status: "abandoned" },
    });
    await load();
  }
  async function addProject() {
    if (!projectForm.name.trim()) return;
    await mutateEntity({
      entityType: "project",
      operation: "create",
      payload: {
        name: projectForm.name.trim(),
        description: projectForm.description.trim() || null,
        target_date: projectForm.target || null,
        goal_id: projectForm.goalId || null,
        status: "active",
      },
    });
    setProjectForm({ name: "", description: "", target: "", goalId: "" });
    setForm(null);
    await load();
  }
  async function setProjectStatus(p: Project, status: string) {
    await mutateEntity({
      entityType: "project",
      operation: "update",
      entityId: p.id,
      baseVersion: p.version ?? null,
      clientUpdatedAt: p.updated_at || undefined,
      payload: { status },
    });
    await load();
  }
  async function archiveProject(p: Project) {
    await mutateEntity({
      entityType: "project",
      operation: "update",
      entityId: p.id,
      baseVersion: p.version ?? null,
      clientUpdatedAt: p.updated_at || undefined,
      payload: { status: "archived" },
    });
    await load();
  }
  async function addTask(projectId: string) {
    const title = (newTask[projectId] || "").trim();
    if (!title) return;
    await mutateEntity({
      entityType: "task",
      operation: "create",
      payload: { title, status: "todo", priority: "medium", project_id: projectId },
    });
    setNewTask((v) => ({ ...v, [projectId]: "" }));
    await load();
  }

  const activeGoals = goals.filter((g) => g.status === "active");
  const activeProjects = projects.filter((p) => p.status === "active");
  const avgGoal = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + Number(g.progress || 0), 0) / activeGoals.length)
    : 0;
  const overdueProjects = activeProjects.filter(
    (p) =>
      (days(p.target_date) ?? 999) < 0 ||
      tasks.some(
        (t) => t.project_id === p.id && t.status !== "done" && t.due_at && new Date(t.due_at).getTime() < Date.now(),
      ),
  ).length;
  const normalized = query.trim().toLowerCase();
  const filteredGoals = useMemo(
    () =>
      activeGoals.filter((g) => !normalized || `${g.title} ${g.description || ""}`.toLowerCase().includes(normalized)),
    [activeGoals, normalized],
  );
  const filteredProjects = useMemo(
    () =>
      activeProjects.filter(
        (p) => !normalized || `${p.name} ${p.description || ""}`.toLowerCase().includes(normalized),
      ),
    [activeProjects, normalized],
  );

  if (loading)
    return (
      <div className="mx-auto max-w-7xl space-y-4 animate-licia-page-in">
        <Card className="p-5">
          <div className="h-8 w-1/2 animate-licia-shimmer rounded-xl bg-bg" />
          <div className="mt-4 h-28 animate-licia-shimmer rounded-2xl bg-bg" />
        </Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-licia-page-in">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-accent/20 bg-gradient-to-br from-accent/10 via-surface to-surface p-5 shadow-sm sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-[.15em] text-accent">
              <Target size={14} /> {tr("Satu workspace")}
            </p>
            <h1 className="mt-2 font-display text-3xl text-text sm:text-4xl">{tr("Target & Proyek")}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-textMuted">
              {tr(
                "Target menentukan arah, proyek mengubahnya menjadi pekerjaan nyata, dan task menjadi langkah yang bisa dikerjakan hari ini.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => setForm(form === "goal" ? null : "goal")}>
              <Target size={15} /> {tr("Target baru")}
            </PrimaryButton>
            <button
              onClick={() => setForm(form === "project" ? null : "project")}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3.5 text-xs font-semibold text-text transition hover:border-accent/25 hover:text-accent"
            >
              <FolderKanban size={15} /> {tr("Proyek baru")}
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-3 transition hover:-translate-y-0.5 hover:shadow-sm">
            <p className="text-2xs text-textMuted">{tr("Target aktif")}</p>
            <p className="mt-1 font-display text-2xl text-text">{activeGoals.length}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-3 transition hover:-translate-y-0.5 hover:shadow-sm">
            <p className="text-2xs text-textMuted">{tr("Rata-rata progres")}</p>
            <p className="mt-1 font-display text-2xl text-accent">{avgGoal}%</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-3 transition hover:-translate-y-0.5 hover:shadow-sm">
            <p className="text-2xs text-textMuted">{tr("Proyek aktif")}</p>
            <p className="mt-1 font-display text-2xl text-text">{activeProjects.length}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-3 transition hover:-translate-y-0.5 hover:shadow-sm">
            <p className="text-2xs text-textMuted">{tr("Perlu perhatian")}</p>
            <p className="mt-1 font-display text-2xl text-danger">{overdueProjects}</p>
          </div>
        </div>
      </section>

      {form === "goal" && (
        <Card className="border-accent/20 bg-accent/5">
          <SectionTitle>{tr("Target baru")}</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-3">
            <TextInput
              value={goalForm.title}
              onChange={(e) => setGoalForm((v) => ({ ...v, title: e.target.value }))}
              placeholder={tr("Contoh: Lulus kuliah")}
            />
            <input
              type="date"
              value={goalForm.target}
              onChange={(e) => setGoalForm((v) => ({ ...v, target: e.target.value }))}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            />
            <TextInput
              value={goalForm.next}
              onChange={(e) => setGoalForm((v) => ({ ...v, next: e.target.value }))}
              placeholder={tr("Langkah berikutnya (opsional)")}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <PrimaryButton onClick={() => void addGoal()}>{tr("Simpan target")}</PrimaryButton>
          </div>
        </Card>
      )}
      {form === "project" && (
        <Card className="border-accent/20 bg-accent/5">
          <SectionTitle>{tr("Proyek baru")}</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <TextInput
              value={projectForm.name}
              onChange={(e) => setProjectForm((v) => ({ ...v, name: e.target.value }))}
              placeholder={tr("Nama proyek")}
            />
            <input
              type="date"
              value={projectForm.target}
              onChange={(e) => setProjectForm((v) => ({ ...v, target: e.target.value }))}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            />
            <textarea
              value={projectForm.description}
              onChange={(e) => setProjectForm((v) => ({ ...v, description: e.target.value }))}
              rows={3}
              className="sm:col-span-2 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-accent/30"
              placeholder={tr("Outcome proyek…")}
            />
            <select
              value={projectForm.goalId}
              onChange={(e) => setProjectForm((v) => ({ ...v, goalId: e.target.value }))}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            >
              <option value="">{tr("Tanpa target")}</option>
              {activeGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex justify-end">
            <PrimaryButton onClick={() => void addProject()}>{tr("Simpan proyek")}</PrimaryButton>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          <button
            onClick={() => setTab("all")}
            className={clsx(
              "rounded-lg px-3 py-2 text-xs font-semibold transition",
              tab === "all" ? "bg-accent text-white" : "text-textMuted hover:text-text",
            )}
          >
            {tr("Semua")}
          </button>
          <button
            onClick={() => setTab("goals")}
            className={clsx(
              "rounded-lg px-3 py-2 text-xs font-semibold transition",
              tab === "goals" ? "bg-accent text-white" : "text-textMuted hover:text-text",
            )}
          >
            {tr("Target")}
          </button>
          <button
            onClick={() => setTab("projects")}
            className={clsx(
              "rounded-lg px-3 py-2 text-xs font-semibold transition",
              tab === "projects" ? "bg-accent text-white" : "text-textMuted hover:text-text",
            )}
          >
            {tr("Proyek")}
          </button>
        </div>
        <div className="relative min-w-0 sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-xs text-text outline-none focus:border-accent/30 focus:ring-2 focus:ring-accent/15"
            placeholder={tr("Cari target atau proyek…")}
          />
        </div>
      </div>

      {(tab === "all" || tab === "goals") && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[.14em] text-accent">{tr("Arah")}</p>
              <h2 className="font-display text-xl text-text">{tr("Target yang sedang dikejar")}</h2>
            </div>
            <span className="text-2xs text-textMuted">
              {tr("{filteredGoals_length} target", { filteredGoals_length: filteredGoals.length })}
            </span>
          </div>
          {filteredGoals.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredGoals.map((g) => {
                const d = days(g.target_date);
                const linked = projects.filter((p) => p.goal_id === g.id);
                return (
                  <Card
                    key={g.id}
                    className="dashboard-module-card group min-w-0 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-accent/25 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
                        <Target size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-bg px-2 py-1 text-2xs font-semibold text-textMuted">
                            {g.status}
                          </span>
                          {d !== null && (
                            <span
                              className={clsx(
                                "rounded-full px-2 py-1 text-2xs",
                                d < 0 ? "bg-danger/10 text-danger" : "bg-bg text-textMuted",
                              )}
                            >
                              {d < 0
                                ? tr("{abs} hari terlambat", { abs: Math.abs(d) })
                                : d === 0
                                  ? tr("hari ini")
                                  : `H-${d}`}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 break-words text-sm font-semibold text-text">{g.title}</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-700"
                            style={{ width: `${clamp(Number(g.progress || 0))}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-2xs text-textMuted">
                          <span>
                            {clamp(Number(g.progress || 0))}
                            {tr("% progres")}
                          </span>
                          {g.target_date && <span>{g.target_date}</span>}
                        </div>
                        {g.next_step && (
                          <p className="mt-2 text-2xs text-textMuted">
                            {tr("Berikutnya: {next_step}", { next_step: g.next_step })}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              void updateGoal(g, Number(g.progress || 0) >= 100 ? 0 : Number(g.progress || 0) + 5)
                            }
                            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
                          >
                            +5%
                          </button>
                          {linked.length > 0 && (
                            <button
                              onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-2xs font-semibold text-textMuted"
                            >
                              {tr("Proyek ({linked_length})", { linked_length: linked.length })}{" "}
                              <ChevronDown
                                size={11}
                                className={expanded === g.id ? "rotate-180 transition" : "transition"}
                              />
                            </button>
                          )}
                          <button
                            onClick={() => void archiveGoal(g)}
                            className="rounded-lg p-1.5 text-textMuted hover:text-danger"
                            title={tr("Arsipkan")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {expanded === g.id && (
                          <div className="mt-3 space-y-1.5">
                            {linked.map((p) => (
                              <Link
                                key={p.id}
                                href="#proyek"
                                onClick={() => setTab("projects")}
                                className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2"
                              >
                                <FolderKanban size={12} className="text-accent" />
                                <span className="min-w-0 flex-1 truncate text-2xs text-text">{p.name}</span>
                                <ArrowRight size={11} className="text-textMuted" />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={tr("Belum ada target aktif")}
              description={tr("Buat target lalu hubungkan proyek untuk membangun roadmap yang jelas.")}
            />
          )}
        </section>
      )}

      {(tab === "all" || tab === "projects") && (
        <section id="proyek">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[.14em] text-accent">{tr("Eksekusi")}</p>
              <h2 className="font-display text-xl text-text">{tr("Proyek yang sedang berjalan")}</h2>
            </div>
            <span className="text-2xs text-textMuted">
              {tr("{filteredProjects_len} proyek", { filteredProjects_len: filteredProjects.length })}
            </span>
          </div>
          {filteredProjects.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredProjects.map((p) => {
                const pt = tasks.filter((t) => t.project_id === p.id && t.status !== "done");
                const allPt = tasks.filter((t) => t.project_id === p.id);
                const donePt = allPt.filter((t) => t.status === "done").length;
                const pct = allPt.length ? Math.round((donePt / allPt.length) * 100) : 0;
                const d = days(p.target_date);
                const goal = activeGoals.find((g) => g.id === p.goal_id);
                const focus = focusRows
                  .filter((f) => allPt.some((t) => t.id === f.task_id))
                  .reduce((s, f) => s + Number(f.focus_minutes || 0), 0);
                return (
                  <Card
                    key={p.id}
                    className="dashboard-module-card group min-w-0 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-accent/25 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
                        <FolderKanban size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-bg px-2 py-1 text-2xs font-semibold text-textMuted">
                            {p.status}
                          </span>
                          {goal && (
                            <span className="rounded-full bg-success/10 px-2 py-1 text-2xs text-success">
                              ↳ {goal.title}
                            </span>
                          )}
                          {d !== null && (
                            <span
                              className={clsx(
                                "rounded-full px-2 py-1 text-2xs",
                                d < 0 ? "bg-danger/10 text-danger" : "bg-bg text-textMuted",
                              )}
                            >
                              {d < 0
                                ? tr("{abs} hari terlambat", { abs: Math.abs(d) })
                                : d === 0
                                  ? tr("hari ini")
                                  : `H-${d}`}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 break-words text-sm font-semibold text-text">{p.name}</p>
                        <p className="mt-1 text-2xs text-textMuted">
                          {tr("{donePt}/{allPt_length} task selesai · {focus} menit fokus", {
                            donePt,
                            allPt_length: allPt.length,
                            focus,
                          })}
                        </p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {p.description && (
                          <p className="mt-2 break-words text-2xs leading-relaxed text-textMuted">{p.description}</p>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            value={newTask[p.id] || ""}
                            onChange={(e) => setNewTask((v) => ({ ...v, [p.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void addTask(p.id);
                            }}
                            placeholder={tr("Tambah task cepat…")}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text outline-none focus:ring-2 focus:ring-accent/30"
                          />
                          <button onClick={() => void addTask(p.id)} className="rounded-lg bg-accent p-2 text-white">
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => void setProjectStatus(p, p.status === "active" ? "paused" : "active")}
                            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-2xs font-semibold text-textMuted hover:text-accent"
                          >
                            {p.status === "active" ? tr("Jeda") : tr("Aktifkan")}
                          </button>
                          <button
                            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-2xs font-semibold text-textMuted"
                          >
                            {tr("Task")}{" "}
                            <ChevronDown
                              size={11}
                              className={expanded === p.id ? "rotate-180 transition" : "transition"}
                            />
                          </button>
                          <button
                            onClick={() => void setProjectStatus(p, "completed")}
                            className="rounded-lg p-1.5 text-textMuted hover:text-success"
                            title={tr("Tandai selesai")}
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => void archiveProject(p)}
                            className="rounded-lg p-1.5 text-textMuted hover:text-danger"
                            title={tr("Arsipkan")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {expanded === p.id && (
                          <div className="mt-3 space-y-1.5">
                            {pt.length ? (
                              pt.slice(0, 6).map((t) => (
                                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2">
                                  <ListChecks size={12} className="text-accent" />
                                  <span className="min-w-0 flex-1 truncate text-2xs text-text">{t.title}</span>
                                  {t.estimated_minutes && (
                                    <span className="text-2xs text-textMuted">{t.estimated_minutes}m</span>
                                  )}
                                  <Link href={`/focus?task=${t.id}`} className="text-textMuted hover:text-accent">
                                    <Timer size={12} />
                                  </Link>
                                </div>
                              ))
                            ) : (
                              <p className="rounded-lg border border-dashed border-border p-3 text-2xs text-textMuted">
                                {tr("Tidak ada task terbuka untuk proyek ini.")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={tr("Belum ada proyek aktif")}
              description={tr("Buat proyek dari target atau mulai dari outcome yang sedang kamu kerjakan.")}
            />
          )}
        </section>
      )}
    </div>
  );
}
