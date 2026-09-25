"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  AlarmClock,
  BrainCircuit,
  CalendarDays,
  Inbox,
  Link2,
  Wand2,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Columns3,
  FolderKanban,
  Layers3,
  List,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, TextInput, notifyToast } from "@/components/ui";
import { dateStrInTimezone, localDateTimeToIso } from "@/lib/date";
import { createDefaultTaskReminder, getDefaultReminderMinutes, syncExistingTaskReminder } from "@/lib/reminders/schedule";

type Subtask = { id: string; title: string; status: "todo" | "done" };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_at: string | null;
  estimated_minutes: number | null;
  project_id: string | null;
  area_id: string | null;
  subtasks: Subtask[];
};
type Project = { id: string; name: string };
type Area = { id: string; name: string; icon: string | null };
type FilterMode = "all" | "next" | "today" | "unscheduled" | "high" | "done";

const priorityLabel = { low: "Rendah", medium: "Sedang", high: "Tinggi" } as const;
const priorityClass = {
  low: "border-border bg-bg text-textMuted",
  medium: "border-accent/15 bg-accent/10 text-accent",
  high: "border-danger/15 bg-danger/10 text-danger",
} as const;
const statusMeta: Record<Task["status"], { label: string; icon: LucideIcon; className: string }> = {
  todo: { label: "Berikutnya", icon: Circle, className: "text-textMuted" },
  in_progress: { label: "Dikerjakan", icon: Clock3, className: "text-accent" },
  done: { label: "Selesai", icon: CheckCircle2, className: "text-success" },
};

function splitDueAt(value: string | null, timezone: string) {
  if (!value) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}

function formatDue(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function dayOnly(value: string, timezone: string) {
  return dateStrInTimezone(new Date(value), timezone);
}

function relativeDue(value: string) {
  const delta = new Date(value).getTime() - Date.now();
  const minutes = Math.round(Math.abs(delta) / 60000);
  if (minutes < 60) return delta < 0 ? `${minutes} mnt terlambat` : `${minutes} mnt lagi`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return delta < 0 ? `${hours} jam terlambat` : `${hours} jam lagi`;
  const days = Math.round(hours / 24);
  return delta < 0 ? `${days} hari terlambat` : `${days} hari lagi`;
}

export default function TasksPage() {
  const supabase = createClient();
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<"next" | "priority" | "effort">("next");
  const [layout, setLayout] = useState<"list" | "board">("list");
  const [showDone, setShowDone] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as Task["priority"],
    due_date: "",
    due_time: "",
    estimated_minutes: "25",
    project_id: "",
    area_id: "",
  });
  const [editForm, setEditForm] = useState(form);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: profile }, { data: taskData }, { data: projectData }, { data: areaData }] = await Promise.all([
      supabase.from("users").select("timezone").eq("id", user.id).single(),
      supabase.from("tasks").select("id,title,description,status,priority,due_at,estimated_minutes,project_id,area_id,subtasks(id,title,status)").order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("projects").select("id,name").eq("status", "active").order("name"),
      supabase.from("areas").select("id,name,icon").order("name"),
    ]);

    setTimezone(profile?.timezone ?? "Asia/Jakarta");
    setTasks((taskData as Task[]) ?? []);
    setProjects((projectData as Project[]) ?? []);
    setAreas((areaData as Area[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    try {
      const savedView = localStorage.getItem("licia-task-view");
      const savedSort = localStorage.getItem("licia-task-sort");
      const savedMinutes = localStorage.getItem("licia-default-task-minutes");
      const savedPriority = localStorage.getItem("licia-default-priority");
      if (savedView === "board" || savedView === "list") setLayout(savedView);
      if (savedSort === "next" || savedSort === "priority" || savedSort === "effort") setSort(savedSort);
      setForm((current) => ({
        ...current,
        estimated_minutes: savedMinutes && Number(savedMinutes) > 0 ? String(Math.min(480, Number(savedMinutes))) : current.estimated_minutes,
        priority: savedPriority === "low" || savedPriority === "medium" || savedPriority === "high" ? savedPriority : current.priority,
      }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("licia-task-view", layout);
      localStorage.setItem("licia-task-sort", sort);
    } catch {}
  }, [layout, sort]);

  function dueIso(date: string, time: string) {
    return date ? localDateTimeToIso(date, time, timezone) : null;
  }

  async function addTask() {
    if (!form.title.trim() || saving) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const title = form.title.trim();
    const result = await supabase.from("tasks").insert({
      user_id: user.id,
      title,
      description: form.description.trim() || null,
      priority: form.priority,
      due_at: dueIso(form.due_date, form.due_time),
      estimated_minutes: Number(form.estimated_minutes) || null,
      project_id: form.project_id || null,
      area_id: form.area_id || null,
    }).select("id").single();
    if (result.error) {
      notifyToast({ title: "Tugas belum tersimpan", message: result.error.message, tone: "error" });
      setSaving(false);
      return;
    }
    if (result.data?.id) {
      const dueAt = dueIso(form.due_date, form.due_time);
      if (dueAt) { const minutes = await getDefaultReminderMinutes(supabase, user.id); if (minutes > 0) await createDefaultTaskReminder(supabase, user.id, timezone, { id: result.data.id, title, due_at: dueAt }, minutes); }
    }
    setCreatedId(result.data?.id ?? null);
    window.setTimeout(() => setCreatedId((current) => current === result.data?.id ? null : current), 1100);
    notifyToast({ title: "Tugas ditambahkan ✨", message: title, tone: "success" });
    setForm((current) => ({ ...current, title: "", description: "", due_date: "", due_time: "", project_id: "", area_id: "" }));
    await load();
    setSaving(false);
  }

  async function setStatus(task: Task, status: Task["status"]) {
    const result = await supabase.from("tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", task.id);
    if (result.error) {
      notifyToast({ title: "Status belum berubah", message: result.error.message, tone: "error" });
      return;
    }
    if (status === "done") {
      await supabase.from("reminders").update({ enabled: false, status: "cancelled", updated_at: new Date().toISOString() }).eq("target_type", "task").eq("target_id", task.id).in("status", ["pending", "waiting_for_device", "failed"]);
      setCompletedId(task.id);
      window.setTimeout(() => setCompletedId((current) => current === task.id ? null : current), 850);
      notifyToast({ title: "Tugas selesai ✨", message: task.title, tone: "success" });
    } else {
      notifyToast({ title: "Status tugas diperbarui", message: task.title, tone: "info" });
    }
    await load();
  }

  async function toggleSub(sub: Subtask) {
    const result = await supabase.from("subtasks").update({ status: sub.status === "done" ? "todo" : "done" }).eq("id", sub.id);
    if (result.error) {
      notifyToast({ title: "Langkah belum berubah", message: result.error.message, tone: "error" });
      return;
    }
    await load();
  }

  async function addSubtask(taskId: string) {
    const title = (newSub[taskId] ?? "").trim();
    if (!title) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const result = await supabase.from("subtasks").insert({ user_id: user.id, task_id: taskId, title });
    if (result.error) {
      notifyToast({ title: "Langkah belum ditambahkan", message: result.error.message, tone: "error" });
      return;
    }
    setNewSub((current) => ({ ...current, [taskId]: "" }));
    notifyToast({ title: "Langkah ditambahkan", message: title, tone: "success" });
    await load();
  }

  async function deleteTask(id: string) {
    const target = tasks.find((task) => task.id === id);
    if (!target || removingId) return;
    setRemovingId(id);
    window.setTimeout(async () => {
      const result = await supabase.from("tasks").delete().eq("id", id);
      if (result.error) {
        setRemovingId(null);
        notifyToast({ title: "Tugas belum terhapus", message: result.error.message, tone: "error" });
        return;
      }
      setExpandedId(null);
      setRemovingId(null);
      await supabase.from("reminders").update({ enabled: false, status: "cancelled", updated_at: new Date().toISOString() }).eq("target_type", "task").eq("target_id", target.id).in("status", ["pending", "waiting_for_device", "failed"]);
      notifyToast({ title: "Tugas dihapus", message: target.title, tone: "success" });
      await load();
    }, 260);
  }

  function startEdit(task: Task) {
    const due = splitDueAt(task.due_at, timezone);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      due_date: due.date,
      due_time: due.time,
      estimated_minutes: String(task.estimated_minutes ?? 25),
      project_id: task.project_id ?? "",
      area_id: task.area_id ?? "",
    });
    setEditingId(task.id);
    setExpandedId(task.id);
  }

  async function saveEdit(id: string) {
    if (!editForm.title.trim() || savingId) return;
    setSavingId(id);
    const result = await supabase.from("tasks").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      priority: editForm.priority,
      due_at: dueIso(editForm.due_date, editForm.due_time),
      estimated_minutes: Number(editForm.estimated_minutes) || null,
      project_id: editForm.project_id || null,
      area_id: editForm.area_id || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (result.error) {
      notifyToast({ title: "Perubahan belum tersimpan", message: result.error.message, tone: "error" });
      setSavingId(null);
      return;
    }
    const savedDue = dueIso(editForm.due_date, editForm.due_time);
    if (savedDue) {
      const updatedTask = { id, title: editForm.title.trim(), due_at: savedDue };
      const synced = await syncExistingTaskReminder(supabase, (await supabase.auth.getUser()).data.user?.id || "", timezone, updatedTask);
      if (!synced) { const uid = (await supabase.auth.getUser()).data.user?.id; if (uid) { const minutes = await getDefaultReminderMinutes(supabase, uid); if (minutes > 0) await createDefaultTaskReminder(supabase, uid, timezone, updatedTask, minutes); } }
    } else {
      await supabase.from("reminders").update({ enabled: false, status: "cancelled", updated_at: new Date().toISOString() }).eq("target_type", "task").eq("target_id", id).in("status", ["pending", "waiting_for_device", "failed"]);
    }
    setEditingId(null);
    setSavingId(null);
    notifyToast({ title: "Tugas diperbarui", message: editForm.title.trim(), tone: "success" });
    await load();
  }

  const today = dateStrInTimezone(new Date(), timezone);
  const stats = useMemo(() => {
    const active = tasks.filter((task) => task.status !== "done");
    return {
      active: active.length,
      done: tasks.length - active.length,
      today: active.filter((task) => task.due_at && dayOnly(task.due_at, timezone) === today).length,
      overdue: active.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now()).length,
      effort: active.reduce((sum, task) => sum + (task.estimated_minutes || 0), 0),
    };
  }, [tasks, timezone, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!showDone && filter !== "done" && task.status === "done") return false;
      if (filter === "done" && task.status !== "done") return false;
      if (filter === "next" && (task.status === "done" || !task.due_at)) return false;
      if (filter === "today" && (!task.due_at || dayOnly(task.due_at, timezone) !== today || task.status === "done")) return false;
      if (filter === "unscheduled" && (task.status === "done" || task.due_at)) return false;
      if (filter === "high" && (task.priority !== "high" || task.status === "done")) return false;
      return !q || `${task.title} ${task.description ?? ""}`.toLowerCase().includes(q);
    }).sort((a, b) => {
      if (sort === "priority") return ({ high: 0, medium: 1, low: 2 }[a.priority]) - ({ high: 0, medium: 1, low: 2 }[b.priority]);
      if (sort === "effort") return (a.estimated_minutes ?? 9999) - (b.estimated_minutes ?? 9999);
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });
  }, [tasks, showDone, filter, search, sort, timezone, today]);

  const projectName = (id: string | null) => id ? projects.find((project) => project.id === id)?.name : null;
  const areaName = (id: string | null) => id ? areas.find((area) => area.id === id)?.name : null;
  const shortTasks = filtered.filter((task) => task.status !== "done" && (task.estimated_minutes ?? 999) <= 30).slice(0, 3);
  const filterItems: Array<{ id: FilterMode; label: string }> = [
    { id: "all", label: "Semua" },
    { id: "today", label: "Hari ini" },
    { id: "next", label: "Bertenggat" },
    { id: "high", label: "Prioritas tinggi" },
    { id: "unscheduled", label: "Tanpa tanggal" },
    { id: "done", label: "Selesai" },
  ];

  const TaskCard = ({ task, index }: { task: Task; index: number }) => {
    const expanded = expandedId === task.id;
    const editing = editingId === task.id;
    const meta = statusMeta[task.status];
    const StatusIcon = meta.icon;
    const overdue = Boolean(task.due_at && task.status !== "done" && new Date(task.due_at).getTime() < Date.now());
    const completedSubtasks = task.subtasks.filter((sub) => sub.status === "done").length;
    const progress = task.subtasks.length ? Math.round((completedSubtasks / task.subtasks.length) * 100) : 0;

    return (
      <article
        className={clsx(
          "task-modern-card group relative overflow-hidden rounded-[1.35rem] border bg-surface p-4 shadow-sm sm:p-5",
          "animate-licia-reveal",
          removingId === task.id && "animate-licia-delete-out",
          completedId === task.id && "animate-licia-check-burst border-success/25",
          createdId === task.id && "animate-licia-created-card border-accent/35",
          overdue ? "border-danger/20" : "border-border",
        )}
        style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}
      >
        {overdue && <span className="absolute inset-y-0 left-0 w-1 bg-danger" aria-hidden />}
        <div className="flex min-w-0 items-start gap-3">
          <button
            onClick={() => setStatus(task, task.status === "done" ? "todo" : "done")}
            className={clsx(
              "touch-target mt-[-3px] flex shrink-0 items-center justify-center rounded-2xl border border-border bg-bg/60 transition hover:scale-105 active:scale-95",
              completedId === task.id && "task-complete-ring animate-licia-success-pop",
            )}
            aria-label={task.status === "done" ? "Tandai belum selesai" : "Tandai selesai"}
          >
            <StatusIcon size={22} className={meta.className} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <button onClick={() => setExpandedId(expanded ? null : task.id)} className="min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <p className={clsx("break-words text-[15px] font-bold leading-snug text-text sm:text-base", task.status === "done" && "text-textMuted line-through")}>{task.title}</p>
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap gap-1.5 text-[10px] text-textMuted">
                  {task.due_at ? <span className={clsx("rounded-lg border px-2 py-1", overdue ? "border-danger/15 bg-danger/5 font-semibold text-danger" : "border-border bg-bg")}>{formatDue(task.due_at, timezone)} · {relativeDue(task.due_at)}</span> : <span className="rounded-lg border border-border bg-bg px-2 py-1">Tanpa deadline</span>}
                  {task.estimated_minutes && <span className="rounded-lg border border-border bg-bg px-2 py-1">{task.estimated_minutes} mnt</span>}
                  {projectName(task.project_id) && <span className="rounded-lg border border-border bg-bg px-2 py-1">{projectName(task.project_id)}</span>}
                  {areaName(task.area_id) && <span className="rounded-lg border border-border bg-bg px-2 py-1">{areaName(task.area_id)}</span>}
                </div>
              </button>
              <span className={clsx("w-fit shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold", priorityClass[task.priority])}>{priorityLabel[task.priority]}</span>
            </div>

            {task.description && !expanded && <p className="mt-3 line-clamp-2 break-words text-xs leading-relaxed text-textMuted">{task.description}</p>}
            {task.subtasks.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-[9px] text-textMuted"><span>{completedSubtasks}/{task.subtasks.length} langkah</span><span>{progress}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-success transition-all duration-700" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
          </div>

          <button onClick={() => setExpandedId(expanded ? null : task.id)} className="touch-target shrink-0 rounded-xl text-textMuted transition hover:bg-bg hover:text-accent" aria-label={expanded ? "Tutup detail" : "Buka detail"}>
            <MoreHorizontal size={18} />
          </button>
        </div>

        {expanded && (
          <div className="mt-5 animate-licia-pop-in border-t border-border pt-4">
            {editing ? (
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <TextInput value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} placeholder="Judul tugas" />
                <select value={editForm.priority} onChange={(event) => setEditForm({ ...editForm, priority: event.target.value as Task["priority"] })} className="min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text"><option value="low">Rendah</option><option value="medium">Sedang</option><option value="high">Tinggi</option></select>
                <textarea value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} rows={3} className="resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text sm:col-span-2" placeholder="Konteks / definisi selesai…" />
                <input type="date" value={editForm.due_date} onChange={(event) => setEditForm({ ...editForm, due_date: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text" />
                <input type="time" value={editForm.due_time} onChange={(event) => setEditForm({ ...editForm, due_time: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text" />
                <input type="number" min="1" max="480" value={editForm.estimated_minutes} onChange={(event) => setEditForm({ ...editForm, estimated_minutes: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text" placeholder="Menit" />
                <select value={editForm.project_id} onChange={(event) => setEditForm({ ...editForm, project_id: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text"><option value="">Tanpa proyek</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
                <select value={editForm.area_id} onChange={(event) => setEditForm({ ...editForm, area_id: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text"><option value="">Tanpa area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.icon || "◉"} {area.name}</option>)}</select>
                <div className="flex flex-wrap gap-2 sm:col-span-2"><button onClick={() => setEditingId(null)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-textMuted"><X size={13} /> Batal</button><PrimaryButton onClick={() => saveEdit(task.id)} disabled={savingId === task.id} className="text-xs">{savingId === task.id && <Loader2 size={13} className="animate-spin" />} Simpan perubahan</PrimaryButton></div>
              </div>
            ) : (
              <>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-2xl bg-bg p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-textMuted">Konteks</p><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-text">{task.description || "Belum ada konteks tambahan."}</p></div>
                  <div className="rounded-2xl bg-bg p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-textMuted">Status</p><div className="mt-2 flex flex-wrap gap-1.5">{(Object.keys(statusMeta) as Task["status"][]).map((status) => <button key={status} onClick={() => setStatus(task, status)} className={clsx("rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold", task.status === status ? "border-accent bg-accent/10 text-accent" : "border-border text-textMuted")}>{statusMeta[status].label}</button>)}</div></div>
                  <div className="rounded-2xl bg-bg p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-textMuted">Relasi</p><div className="mt-2 space-y-1 text-xs text-text">{projectName(task.project_id) && <p className="flex items-center gap-1.5"><FolderKanban size={12} className="text-accent" /> {projectName(task.project_id)}</p>}{areaName(task.area_id) && <p>{areaName(task.area_id)}</p>}{!projectName(task.project_id) && !areaName(task.area_id) && <p className="text-textMuted">Belum terhubung</p>}</div></div>
                </div>

                {task.subtasks.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-border p-3.5"><div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Langkah kecil</span><span className="text-textMuted">{completedSubtasks}/{task.subtasks.length}</span></div><div className="space-y-1.5">{task.subtasks.map((sub) => <button key={sub.id} onClick={() => toggleSub(sub)} className="flex w-full min-w-0 items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-left text-xs"><span className={clsx("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", sub.status === "done" ? "border-success bg-success text-white" : "border-border text-transparent")}>{sub.status === "done" && <Check size={11} />}</span><span className={clsx("min-w-0 break-words", sub.status === "done" ? "text-textMuted line-through" : "text-text")}>{sub.title}</span></button>)}</div></div>
                )}

                <div className="task-action-row mt-3 flex min-w-0 flex-wrap gap-2">
                  <a href={`/focus?task=${task.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/5 px-3 text-xs font-semibold text-accent transition hover:-translate-y-0.5"><Timer size={13} /> Fokus</a>
                  <a href={`/calendar?task=${task.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted transition hover:-translate-y-0.5 hover:text-accent"><CalendarClock size={13} /> Jadwalkan</a>
                  <a href={`/chat?prompt=${encodeURIComponent(`Tinjau tugas "${task.title}" bersama agenda, project, target, dan fokus saya lalu sarankan langkah berikutnya.`)}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-accent/15 bg-accent/5 px-3 text-xs font-semibold text-accent transition hover:-translate-y-0.5"><Sparkles size={13} /> Minta Licia</a>
                  <button onClick={() => startEdit(task)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted transition hover:-translate-y-0.5 hover:text-text"><Pencil size={13} /> Edit</button>
                  <button onClick={() => deleteTask(task.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-danger/15 bg-danger/5 px-3 text-xs font-semibold text-danger transition hover:-translate-y-0.5"><Trash2 size={13} /> Hapus</button>
                </div>

                <div className="mt-3 flex min-w-0 gap-2 border-t border-border pt-3"><input value={newSub[task.id] ?? ""} onChange={(event) => setNewSub((current) => ({ ...current, [task.id]: event.target.value }))} onKeyDown={(event) => event.key === "Enter" && addSubtask(task.id)} placeholder="Tambahkan langkah kecil…" className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-xs text-text outline-none focus:ring-2 focus:ring-accent/30" /><button onClick={() => addSubtask(task.id)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-textMuted hover:text-accent"><Plus size={13} /> Tambah</button></div>
              </>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="task-page mx-auto min-w-0 max-w-7xl space-y-5 pb-8 animate-licia-page-in">
      <header className="task-hero relative overflow-hidden rounded-[2rem] border border-accent/15 p-4 shadow-sm sm:p-6 lg:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-accent/5 blur-3xl" aria-hidden />
        <div className="relative grid gap-5 xl:grid-cols-[1fr_390px] xl:items-stretch">
          <div className="min-w-0 rounded-[1.6rem] border border-border/80 bg-surface/60 p-4 backdrop-blur-sm sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-accent"><ListChecks size={12} /> Execution OS</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/15 bg-success/5 px-2.5 py-1 text-[9px] font-semibold text-success"><span className="h-1.5 w-1.5 rounded-full bg-success animate-licia-spark" /> Fokus ke eksekusi</span>
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-[1.85rem] leading-[1.08] text-text sm:text-4xl">Tugas bukan lagi daftar panjang. Jadikan ia jalur kerja.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-textMuted">Tangkap, pecah, jadwalkan, fokus, lalu biarkan Licia menghubungkan tugas dengan agenda, project, target, Inbox, dan konteks lain.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <a href="/chat?prompt=Tinjau kondisi tugas saya dan susun prioritas terpenting hari ini dari semua data Licia." className="group inline-flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-accent px-3.5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><span className="flex min-w-0 items-center gap-2"><Sparkles size={15} className="shrink-0" /> Prioritas dengan Licia</span><ArrowRight size={14} className="shrink-0 transition group-hover:translate-x-1" /></a>
              <button onClick={() => setComposerOpen((value) => !value)} className="inline-flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-surface/90 px-3.5 text-xs font-semibold text-textMuted transition hover:-translate-y-0.5 hover:border-accent/30 hover:text-accent"><span className="flex min-w-0 items-center gap-2"><Plus size={15} className="shrink-0" /> {composerOpen ? "Tutup tambah cepat" : "Tambah tugas"}</span><span className="text-[9px]">⌘K / Ctrl+K</span></button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[9px] text-textMuted">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-bg px-2.5 py-2"><BrainCircuit size={11} className="text-accent" /> AI lintas modul</span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-bg px-2.5 py-2"><CalendarDays size={11} className="text-accent" /> Kalender terhubung</span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-bg px-2.5 py-2"><Link2 size={11} className="text-accent" /> Project & target</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            {[{ label: "Aktif", value: stats.active }, { label: "Hari ini", value: stats.today }, { label: "Terlambat", value: stats.overdue }, { label: "Menit", value: stats.effort }].map((item, index) => <div key={item.label} style={{ animationDelay: `${index * 70}ms` }} className="rounded-[1.4rem] border border-border bg-surface/85 p-3.5 backdrop-blur-sm animate-licia-card-in"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-textMuted">{item.label}</p><p className={clsx("mt-1 font-display text-2xl text-text sm:text-3xl", item.label === "Terlambat" && stats.overdue > 0 && "text-danger")}>{item.value}</p><p className="mt-1 text-[9px] text-textMuted">{item.label === "Menit" ? "beban estimasi" : "snapshot sekarang"}</p></div>)}
          </div>
        </div>
      </header>

      {composerOpen && (
        <Card className="task-capture border-accent/15 bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-accent">Tambah cepat</p><TextInput value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="Apa yang perlu kamu selesaikan?" className="mt-2 h-12 rounded-2xl bg-bg text-[15px]" /></div>
            <div className="grid gap-2 sm:grid-cols-3 xl:w-[440px]"><input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs text-text" /><input type="time" value={form.due_time} onChange={(event) => setForm({ ...form, due_time: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs text-text" /><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Task["priority"] })} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs font-semibold text-text"><option value="low">Prioritas rendah</option><option value="medium">Prioritas sedang</option><option value="high">Prioritas tinggi</option></select></div>
            <PrimaryButton onClick={addTask} disabled={saving} className="h-12 shrink-0 rounded-2xl px-5">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {saving ? "Menyimpan…" : "Tambah tugas"}</PrimaryButton>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-[10px] text-textMuted">Enter langsung menyimpan. Detail seperti project, area, durasi, dan konteks bisa ditambahkan setelahnya.</span><a href={`/chat?prompt=${encodeURIComponent("Buatkan tugas dari pesan atau konteks yang akan saya jelaskan berikut: ")}`} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-accent hover:underline"><ArrowRight size={12} /> Buat lewat Chat Licia</a></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={() => setForm({ ...form, title: "Selesaikan tugas terpenting hari ini", priority: "high" })} className="rounded-xl border border-border bg-bg p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/30"><b className="text-xs text-text">Prioritas hari ini</b><span className="mt-1 block text-[10px] text-textMuted">Isi cepat untuk pekerjaan paling penting.</span></button><button onClick={() => setForm({ ...form, title: "Tindak lanjuti agenda berikutnya", description: "Tindak lanjut dari agenda kalender.", priority: "medium" })} className="rounded-xl border border-border bg-bg p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/30"><b className="text-xs text-text">Follow-up agenda</b><span className="mt-1 block text-[10px] text-textMuted">Cocok untuk hasil rapat, kelas, atau janji.</span></button><a href="/chat?prompt=Buatkan tugas dari agenda kalender yang relevan dan hubungkan relasinya." className="rounded-xl border border-accent/15 bg-accent/5 p-3 text-left transition hover:-translate-y-0.5"><b className="text-xs text-accent">Dibuat oleh AI</b><span className="mt-1 block text-[10px] text-textMuted">Biarkan Licia membaca konteks lintas modul.</span></a></div>
        </Card>
      )}

      <section className="task-bridge-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/chat?prompt=Lihat agenda kalender saya hari ini dan jadikan agenda yang relevan sebagai tugas terhubung.", icon: CalendarDays, label: "Agenda → Tugas", text: "Tarik agenda yang memang perlu ditindaklanjuti." },
          { href: "/chat?prompt=Lihat Smart Inbox saya dan ubah item yang pantas menjadi tugas.", icon: Inbox, label: "Inbox → Tugas", text: "Ubah tangkapan mentah menjadi eksekusi." },
          { href: "/chat?prompt=Lihat tugas saya yang belum punya slot waktu, lalu jadwalkan yang paling penting ke kalender.", icon: CalendarClock, label: "Tugas → Agenda", text: "Cari ruang waktu nyata untuk pekerjaan." },
          { href: "/chat?prompt=Lihat agenda saya hari ini dan buat pengingat untuk agenda yang penting.", icon: AlarmClock, label: "Agenda → Pengingat", text: "Buat rule pengingat yang terhubung ke agenda." },
        ].map((item, index) => { const Icon = item.icon; return <a key={item.label} href={item.href} style={{ animationDelay: `${index * 60}ms` }} className="task-bridge-card group flex min-w-0 items-center gap-3 rounded-[1.35rem] border border-border bg-surface p-3.5 animate-licia-card-in"><span className="shrink-0 rounded-2xl bg-accent/10 p-2.5 text-accent transition group-hover:scale-110"><Icon size={15} /></span><span className="min-w-0 flex-1"><b className="block break-words text-xs text-text">{item.label}</b><span className="mt-0.5 block break-words text-[9px] leading-relaxed text-textMuted">{item.text}</span></span><ArrowRight size={13} className="shrink-0 text-textMuted transition group-hover:translate-x-1 group-hover:text-accent" /></a>; })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><Layers3 size={15} className="text-accent" /><h2 className="font-display text-lg text-text">Ruang kerja</h2></div><p className="mt-1 text-[10px] text-textMuted">{filtered.length} tugas terlihat · {stats.done} sudah selesai</p></div><div className="flex shrink-0 gap-1 rounded-xl border border-border bg-bg p-1"><button onClick={() => setLayout("list")} className={clsx("touch-target inline-flex items-center justify-center rounded-lg px-2", layout === "list" ? "bg-surface text-accent shadow-sm" : "text-textMuted")} title="Tampilan daftar"><List size={16} /></button><button onClick={() => setLayout("board")} className={clsx("touch-target inline-flex items-center justify-center rounded-lg px-2", layout === "board" ? "bg-surface text-accent shadow-sm" : "text-textMuted")} title="Tampilan papan"><Columns3 size={16} /></button></div></div>
            <div className="mt-4 flex min-w-0 flex-col gap-2 lg:flex-row"><div className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" /><TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari tugas…" className="pl-9" /></div><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs font-semibold text-text"><option value="next">Urutkan: deadline</option><option value="priority">Urutkan: prioritas</option><option value="effort">Urutkan: durasi</option></select></div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">{filterItems.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={clsx("shrink-0 rounded-xl border px-3 py-2 text-[10px] font-semibold transition", filter === item.id ? "border-accent bg-accent text-white shadow-sm" : "border-border bg-surface text-textMuted hover:border-accent/30 hover:text-accent")}>{item.label}</button>)}</div>
            <div className="mt-3 flex items-center justify-between gap-2"><label className="inline-flex items-center gap-2 text-[10px] text-textMuted"><input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} className="accent-[rgb(var(--accent-rgb))]" /> Tampilkan selesai</label><span className="text-[10px] text-textMuted">{timezone.replace("Asia/", "")}</span></div>
          </div>

          <div className="p-3 sm:p-5">
            {loading ? <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-licia-shimmer rounded-2xl bg-bg" />)}</div> : !filtered.length ? <EmptyState title="Belum ada tugas di sini" description={filter === "all" ? "Gunakan Tambah Cepat atau minta Licia menarik tugas dari agenda, Inbox, atau project." : "Coba ubah filter atau pencarian."} /> : layout === "board" ? (
              <div className="task-board grid gap-3 lg:grid-cols-3">{(Object.keys(statusMeta) as Task["status"][]).map((status) => { const items = filtered.filter((task) => task.status === status); const StatusIcon = statusMeta[status].icon; return <div key={status} className="min-w-0 rounded-2xl border border-border bg-bg/45 p-2.5"><div className="flex items-center justify-between px-2 py-2"><div className="flex items-center gap-2"><StatusIcon size={13} className={statusMeta[status].className} /><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-textMuted">{statusMeta[status].label}</p></div><span className="rounded-full bg-surface px-2 py-1 text-[9px] font-bold text-textMuted">{items.length}</span></div><div className="space-y-2">{items.map((task, index) => <TaskCard key={task.id} task={task} index={index} />)}</div></div>; })}</div>
            ) : <div className="space-y-2.5">{filtered.map((task, index) => <TaskCard key={task.id} task={task} index={index} />)}</div>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-accent/15 bg-gradient-to-br from-accent/10 via-surface to-surface p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent animate-licia-float"><Sparkles size={18} /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-accent">Licia melihat konteks</p><h3 className="mt-1 font-display text-xl text-text">Tugas pendek yang bisa diselesaikan sekarang.</h3><p className="mt-1 text-[11px] leading-relaxed text-textMuted">Ini bukan prioritas otomatis. Gunakan sebagai shortlist saat kamu punya energi rendah atau celah waktu kecil.</p></div></div><div className="mt-4 space-y-2">{shortTasks.length ? shortTasks.map((task) => <a key={task.id} href={`/focus?task=${task.id}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface/85 p-3 transition hover:-translate-y-0.5 hover:border-accent/25"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg text-accent"><Timer size={14} /></span><div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold text-text">{task.title}</p><p className="mt-0.5 text-[10px] text-textMuted">{task.estimated_minutes} menit</p></div><ArrowRight size={14} className="shrink-0 text-textMuted" /></a>) : <p className="rounded-2xl bg-bg p-3 text-[10px] leading-relaxed text-textMuted">Belum ada tugas pendek yang cocok. Tambahkan estimasi durasi agar Licia bisa membantu memilih langkah kecil.</p>}</div></Card>
          <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><Target size={15} className="text-accent" /><h3 className="font-display text-lg text-text">Hubungkan dengan Life OS</h3></div><div className="mt-3 grid gap-2">{[{ href: "/calendar", label: "Kalender", text: "Jadikan slot waktu menjadi tindakan nyata." }, { href: "/inbox", label: "Smart Inbox", text: "Pindahkan ide mentah menjadi tugas yang bisa dieksekusi." }, { href: "/projects", label: "Proyek", text: "Tempelkan pekerjaan ke tujuan yang lebih besar." }].map((item) => <a key={item.href} href={item.href} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-bg p-3 transition hover:-translate-y-0.5 hover:border-accent/25"><span className="min-w-0 flex-1"><b className="block text-xs text-text">{item.label}</b><span className="mt-0.5 block break-words text-[10px] leading-relaxed text-textMuted">{item.text}</span></span><ArrowRight size={14} className="shrink-0 text-accent" /></a>)}</div><a href="/guide" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-accent hover:underline">Pelajari semua alur di Panduan <ArrowRight size={12} /></a></Card>
        </div>
      </section>
    </div>
  );
}
