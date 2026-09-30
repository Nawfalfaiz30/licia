"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  AlarmClock,
  BrainCircuit,
  CalendarDays,
  Inbox,
  Link2,
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
import { mutateEntity } from "@/lib/sync/client";
import { Card, EmptyState, PrimaryButton, TextInput, notifyToast } from "@/components/ui";
import { dateStrInTimezone, localDateTimeToIso } from "@/lib/date";
import { createDefaultScheduleReminder, createDefaultTaskReminder, getDefaultReminderMinutes, syncExistingTaskReminder } from "@/lib/reminders/schedule";

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
  version?: number | null;
  updated_at?: string | null;
  subtasks: Subtask[];
};
type Project = { id: string; name: string };
type Area = { id: string; name: string; icon: string | null };
type AgendaRow = { id: string; title: string; block_date: string; start_time: string; end_time: string; task_id: string | null; project_id: string | null; description: string | null; location: string | null; completed_at: string | null; version?: number | null; updated_at?: string | null };
type InboxRow = { id: string; content: string; ai_suggestion: any; status: string; linked_task_id: string | null; version?: number | null; updated_at?: string | null };
type TaskActionResult = { title: string; message: string; items: string[]; tone?: "success" | "info" | "warning" };
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
  const [todayAgenda, setTodayAgenda] = useState<AgendaRow[]>([]);
  const [openInbox, setOpenInbox] = useState<InboxRow[]>([]);
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<TaskActionResult | null>(null);
  const [assistTaskId, setAssistTaskId] = useState<string | null>(null);
  const [priorityPlan, setPriorityPlan] = useState<{ focus?: string; priorities?: Array<{ id?: string; title: string; reason?: string; action?: string; estimated_minutes?: number | null }> } | null>(null);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const resolvedTimezone = (await supabase.from("users").select("timezone").eq("id", user.id).single()).data?.timezone ?? "Asia/Jakarta";
    const todayStr = dateStrInTimezone(new Date(), resolvedTimezone);
    const [{ data: taskData }, { data: projectData }, { data: areaData }, { data: agendaData }, { data: inboxData }] = await Promise.all([
      supabase.from("tasks").select("id,title,description,status,priority,due_at,estimated_minutes,project_id,area_id,version,updated_at,subtasks(id,title,status)").order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("projects").select("id,name").eq("status", "active").order("name"),
      supabase.from("areas").select("id,name,icon").order("name"),
      supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,task_id,project_id,description,location,completed_at,version,updated_at").eq("user_id", user.id).eq("block_date", todayStr).order("start_time", { ascending: true }),
      supabase.from("smart_inbox_items").select("id,content,ai_suggestion,status,linked_task_id,version,updated_at").eq("user_id", user.id).eq("status", "open").order("created_at", { ascending: false }).limit(20),
    ]);

    setTimezone(resolvedTimezone);
    setTasks((taskData as Task[]) ?? []);
    setProjects((projectData as Project[]) ?? []);
    setAreas((areaData as Area[]) ?? []);
    setTodayAgenda((agendaData as AgendaRow[]) ?? []);
    setOpenInbox((inboxData as InboxRow[]) ?? []);
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
    const result = await mutateEntity({
      entityType: "task",
      operation: "create",
      payload: {
        title,
        description: form.description.trim() || null,
        priority: form.priority,
        due_at: dueIso(form.due_date, form.due_time),
        estimated_minutes: Number(form.estimated_minutes) || null,
        project_id: form.project_id || null,
        area_id: form.area_id || null,
      },
    });
    if (!result.ok) {
      notifyToast({ title: "Tugas belum tersimpan", message: result.error || "Perubahan gagal disimpan.", tone: "error" });
      setSaving(false);
      return;
    }
    const createdRecord = result.response?.record;
    const createdTaskId = String(result.response?.entityId || createdRecord?.id || "");
    if (createdTaskId) {
      const dueAt = dueIso(form.due_date, form.due_time);
      if (dueAt && navigator.onLine) { const minutes = await getDefaultReminderMinutes(supabase, user.id); if (minutes > 0) await createDefaultTaskReminder(supabase, user.id, timezone, { id: createdTaskId, title, due_at: dueAt }, minutes); }
    }
    setCreatedId(createdTaskId || null);
    window.setTimeout(() => setCreatedId((current) => current === createdTaskId ? null : current), 1100);
    setForm((current) => ({ ...current, title: "", description: "", due_date: "", due_time: "", project_id: "", area_id: "" }));
    if (result.queued) {
      const optimistic: Task = { id: createdTaskId, title, description: form.description.trim() || null, status: "todo", priority: form.priority, due_at: dueIso(form.due_date, form.due_time), estimated_minutes: Number(form.estimated_minutes) || null, project_id: form.project_id || null, area_id: form.area_id || null, version: 1, updated_at: new Date().toISOString(), subtasks: [] };
      setTasks((current) => [optimistic, ...current]);
      notifyToast({ title: "Tugas disimpan offline", message: "Akan disinkronkan saat koneksi kembali.", tone: "info" });
    } else {
      notifyToast({ title: "Tugas ditambahkan ✨", message: title, tone: "success" });
      await load();
    }
    setSaving(false);
  }

  async function setStatus(task: Task, status: Task["status"]) {
    const result = await mutateEntity({ entityType: "task", operation: "update", entityId: task.id, baseVersion: task.version ?? null, clientUpdatedAt: task.updated_at ?? null, payload: { status } });
    if (!result.ok) {
      notifyToast({ title: result.conflict ? "Perubahan bertabrakan" : "Status belum berubah", message: result.conflict ? "Tinjau konflik sinkronisasi di Pusat Sinkronisasi." : (result.error || "Perubahan gagal disimpan."), tone: "error" });
      return;
    }
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status, version: result.response?.record?.version as number ?? item.version, updated_at: String(result.response?.record?.updated_at || new Date().toISOString()) } : item));
    if (status === "done") {
      if (!result.queued) setCompletedId(task.id);
      window.setTimeout(() => setCompletedId((current) => current === task.id ? null : current), 850);
      notifyToast({ title: "Tugas selesai ✨", message: task.title, tone: "success" });
    } else {
      notifyToast({ title: "Status tugas diperbarui", message: task.title, tone: "info" });
    }
    await load();
  }

  async function toggleSub(sub: Subtask) {
    const result = await mutateEntity({ entityType: "subtask", operation: "update", entityId: sub.id, payload: { status: sub.status === "done" ? "todo" : "done" } });
    if (!result.ok) {
      notifyToast({ title: "Langkah belum berubah", message: result.error || "Perubahan gagal disimpan.", tone: "error" });
      return;
    }
    await load();
  }

  async function addSubtask(taskId: string) {
    const title = (newSub[taskId] ?? "").trim();
    if (!title) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const result = await mutateEntity({ entityType: "subtask", operation: "create", payload: { task_id: taskId, title } });
    if (!result.ok) {
      notifyToast({ title: "Langkah belum ditambahkan", message: result.error || "Perubahan gagal disimpan.", tone: "error" });
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
      const result = await mutateEntity({ entityType: "task", operation: "delete", entityId: id, baseVersion: target.version ?? null, clientUpdatedAt: target.updated_at ?? null, payload: {} });
      if (!result.ok) {
        setRemovingId(null);
        notifyToast({ title: result.conflict ? "Tugas berubah di perangkat lain" : "Tugas belum terhapus", message: result.conflict ? "Tinjau konflik sebelum menghapus data." : (result.error || "Perubahan gagal disimpan."), tone: "error" });
        return;
      }
      setExpandedId(null);
      setRemovingId(null);
      setTasks((current) => current.filter((item) => item.id !== id));
      if (!result.queued) notifyToast({ title: result.queued ? "Tugas dihapus dari perangkat" : "Tugas dihapus", message: result.queued ? "Penghapusan akan disinkronkan." : target.title, tone: "success" });
      if (!result.queued) await load();
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
    const target = tasks.find((task) => task.id === id);
    const result = await mutateEntity({
      entityType: "task",
      operation: "update",
      entityId: id,
      baseVersion: target?.version ?? null,
      clientUpdatedAt: target?.updated_at ?? null,
      payload: {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        priority: editForm.priority,
        due_at: dueIso(editForm.due_date, editForm.due_time),
        estimated_minutes: Number(editForm.estimated_minutes) || null,
        project_id: editForm.project_id || null,
        area_id: editForm.area_id || null,
      },
    });
    if (!result.ok) {
      notifyToast({ title: result.conflict ? "Perubahan bertabrakan" : "Perubahan belum tersimpan", message: result.conflict ? "Tinjau konflik di Pusat Sinkronisasi." : (result.error || "Perubahan gagal disimpan."), tone: "error" });
      setSavingId(null);
      return;
    }
    const savedDue = dueIso(editForm.due_date, editForm.due_time);
    if (savedDue && !result.queued) {
      const updatedTask = { id, title: editForm.title.trim(), due_at: savedDue };
      const synced = await syncExistingTaskReminder(supabase, (await supabase.auth.getUser()).data.user?.id || "", timezone, updatedTask);
      if (!synced) { const uid = (await supabase.auth.getUser()).data.user?.id; if (uid) { const minutes = await getDefaultReminderMinutes(supabase, uid); if (minutes > 0) await createDefaultTaskReminder(supabase, uid, timezone, updatedTask, minutes); } }
    } else if (!result.queued) {
      }
    setEditingId(null);
    setSavingId(null);
    if (result.queued) {
      setTasks((current) => current.map((item) => item.id === id ? { ...item, title: editForm.title.trim(), description: editForm.description.trim() || null, priority: editForm.priority, due_at: dueIso(editForm.due_date, editForm.due_time), estimated_minutes: Number(editForm.estimated_minutes) || null, project_id: editForm.project_id || null, area_id: editForm.area_id || null, updated_at: new Date().toISOString() } : item));
      notifyToast({ title: "Perubahan disimpan offline", message: "Akan disinkronkan saat koneksi kembali.", tone: "info" });
    } else {
      notifyToast({ title: "Tugas diperbarui", message: editForm.title.trim(), tone: "success" });
      await load();
    }
  }

  function showActionResult(result: TaskActionResult) {
    setActionResult(result);
    window.setTimeout(() => setActionResult((current) => current === result ? null : current), 7000);
  }

  async function runPriorityPlan() {
    if (quickAction) return;
    setQuickAction("priority");
    try {
      const response = await fetch("/api/v38/daily-plan?refresh=1", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.plan) throw new Error(data.error || "Rencana prioritas belum tersedia.");
      const plan = data.plan;
      const proposed = Array.isArray(plan.priorities) ? plan.priorities.slice(0, 5) : [];
      const priorityByIndex = ["high", "medium", "medium", "low", "low"] as const;
      const changed: string[] = [];
      for (let index = 0; index < proposed.length; index += 1) {
        const item = proposed[index];
        const id = item?.id ? String(item.id) : "";
        const current = tasks.find((task) => task.id === id);
        if (!current) continue;
        const desired = priorityByIndex[index] ?? "low";
        const rank = { low: 0, medium: 1, high: 2 } as const;
        if (rank[desired] <= rank[current.priority]) continue;
        const result = await mutateEntity({ entityType: "task", operation: "update", entityId: current.id, baseVersion: current.version ?? null, clientUpdatedAt: current.updated_at ?? null, payload: { priority: desired } });
        if (result.ok) changed.push(current.title);
      }
      setPriorityPlan({ focus: plan.focus, priorities: proposed.map((item: any) => ({ id: item.id ? String(item.id) : undefined, title: String(item.title || ""), reason: item.reason, estimated_minutes: item.estimated_minutes })) });
      showActionResult({ title: "Prioritas dengan Licia", message: changed.length ? `${changed.length} tugas langsung diperbarui tingkat prioritasnya.` : "Licia sudah menyusun prioritas. Tidak ada tingkat prioritas yang perlu dinaikkan.", items: changed.slice(0, 6), tone: "success" });
    } catch (error) {
      showActionResult({ title: "Prioritas belum tersusun", message: error instanceof Error ? error.message : "Coba lagi sebentar.", items: [], tone: "warning" });
    } finally { setQuickAction(null); }
  }

  async function convertAgendaToTasks() {
    if (quickAction) return;
    setQuickAction("agenda-task");
    try {
      const candidates = todayAgenda.filter((block) => !block.task_id && !block.completed_at).slice(0, 12);
      if (!candidates.length) {
        showActionResult({ title: "Agenda → Tugas", message: "Tidak ada agenda hari ini yang belum terhubung ke tugas.", items: [], tone: "info" });
        return;
      }
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Belum masuk.");
      const created: string[] = [];
      for (const block of candidates) {
        const startMin = Number(block.start_time.slice(0, 2)) * 60 + Number(block.start_time.slice(3, 5));
        const endMin = Number(block.end_time.slice(0, 2)) * 60 + Number(block.end_time.slice(3, 5));
        const description = [block.description, block.location ? `Lokasi: ${block.location}` : null, `Dibuat dari agenda ${block.block_date} ${block.start_time.slice(0, 5)}–${block.end_time.slice(0, 5)}.`].filter(Boolean).join("\n");
        const result = await mutateEntity({ entityType: "task", operation: "create", payload: { title: block.title, description: description || null, priority: "medium", status: "todo", due_at: localDateTimeToIso(block.block_date, block.end_time.slice(0, 5), timezone), estimated_minutes: Math.max(1, endMin - startMin), project_id: block.project_id || null } });
        if (!result.ok || !result.response?.entityId) continue;
        const link = await mutateEntity({ entityType: "schedule", operation: "update", entityId: block.id, baseVersion: block.version ?? null, clientUpdatedAt: block.updated_at ?? null, payload: { task_id: result.response.entityId } });
        if (!link.ok) { await mutateEntity({ entityType: "task", operation: "delete", entityId: String(result.response.entityId) }); continue; }
        created.push(block.title);
        const reminderMinutes = await getDefaultReminderMinutes(supabase, user.id);
        if (reminderMinutes > 0) await createDefaultTaskReminder(supabase, user.id, timezone, { id: String(result.response.entityId), title: block.title, due_at: localDateTimeToIso(block.block_date, block.end_time.slice(0, 5), timezone) }, reminderMinutes);
      }
      showActionResult({ title: "Agenda → Tugas", message: created.length ? `${created.length} agenda langsung dijadikan tugas.` : "Tidak ada agenda yang berhasil diproses.", items: created.slice(0, 6), tone: created.length ? "success" : "warning" });
      await load();
    } catch (error) {
      showActionResult({ title: "Agenda → Tugas gagal", message: error instanceof Error ? error.message : "Terjadi kesalahan.", items: [], tone: "warning" });
    } finally { setQuickAction(null); }
  }

  async function convertInboxToTasks() {
    if (quickAction) return;
    setQuickAction("inbox-task");
    try {
      const candidates = openInbox.filter((item) => !item.linked_task_id).slice(0, 8);
      if (!candidates.length) { showActionResult({ title: "Inbox → Tugas", message: "Tidak ada item Inbox terbuka yang siap diubah menjadi tugas.", items: [], tone: "info" }); return; }
      const created: string[] = [];
      for (const item of candidates) {
        const suggestion = item.ai_suggestion && typeof item.ai_suggestion === "object" ? item.ai_suggestion : {};
        const result = await mutateEntity({ entityType: "task", operation: "create", payload: { title: suggestion.title || item.content, priority: suggestion.priority || "medium", due_at: suggestion.due_at || null, status: "todo" } });
        if (!result.ok || !result.response?.entityId) continue;
        const marked = await mutateEntity({ entityType: "inbox", operation: "update", entityId: item.id, baseVersion: item.version ?? null, clientUpdatedAt: item.updated_at ?? null, payload: { kind: "task", status: "processed", linked_task_id: result.response.entityId, processed_at: new Date().toISOString() } });
        if (!marked.ok) { await mutateEntity({ entityType: "task", operation: "delete", entityId: String(result.response.entityId) }); continue; }
        created.push(String(suggestion.title || item.content).slice(0, 90));
      }
      showActionResult({ title: "Inbox → Tugas", message: created.length ? `${created.length} item Inbox dipindahkan menjadi tugas.` : "Tidak ada item yang berhasil diproses.", items: created.slice(0, 6), tone: created.length ? "success" : "warning" });
      await load();
    } catch (error) {
      showActionResult({ title: "Inbox → Tugas gagal", message: error instanceof Error ? error.message : "Terjadi kesalahan.", items: [], tone: "warning" });
    } finally { setQuickAction(null); }
  }

  async function scheduleOpenTasks(preferredIds?: string[]) {
    if (quickAction) return;
    setQuickAction("task-agenda");
    try {
      const busy = todayAgenda.filter((block) => !block.completed_at).map((block) => {
        const start = Number(block.start_time.slice(0, 2)) * 60 + Number(block.start_time.slice(3, 5));
        const end = Number(block.end_time.slice(0, 2)) * 60 + Number(block.end_time.slice(3, 5));
        return { start, end };
      });
      const preferredSet = new Set(preferredIds || []);
      const sourceTasks = preferredSet.size ? tasks.filter((task) => preferredSet.has(task.id)) : tasks;
      const candidates = sourceTasks.filter((task) => task.status !== "done" && !task.due_at).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority]) - ({ high: 0, medium: 1, low: 2 }[b.priority])).slice(0, 3);
      if (!candidates.length) { showActionResult({ title: "Tugas → Agenda", message: "Tidak ada tugas terbuka tanpa jadwal yang perlu ditempatkan.", items: [], tone: "info" }); return; }
      const placed: string[] = [];
      const slotDuration = (task: Task) => Math.max(25, Math.min(90, task.estimated_minutes || 30));
      const localClock = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      const [clockHour, clockMinute] = localClock.split(":").map(Number);
      let cursor = Math.max(8 * 60, clockHour * 60 + clockMinute + 15);
      const overlap = (start:number,end:number) => busy.some((x) => start < x.end && end > x.start);
      for (const task of candidates) {
        let placedStart = -1;
        const duration = slotDuration(task);
        for (let startMin = cursor; startMin <= 21 * 60 - duration; startMin += 15) {
          if (!overlap(startMin, startMin + duration)) { placedStart = startMin; break; }
        }
        if (placedStart < 0) continue;
        const endMin = placedStart + duration;
        const fmt = (v:number) => `${String(Math.floor(v/60)).padStart(2, "0")}:${String(v%60).padStart(2, "0")}`;
        const result = await mutateEntity({ entityType: "schedule", operation: "create", payload: { block_date: today, start_time: fmt(placedStart), end_time: fmt(endMin), title: task.title, description: "Dibuat dari Tugas → Agenda.", task_id: task.id, project_id: task.project_id || null, created_by: "manual" } });
        if (!result.ok || !result.response?.entityId) continue;
        placed.push(`${fmt(placedStart)} · ${task.title}`);
        busy.push({ start: placedStart, end: endMin });
        cursor = endMin + 15;
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          const minutes = await getDefaultReminderMinutes(supabase, user.id);
          if (minutes > 0) await createDefaultScheduleReminder(supabase, user.id, timezone, { id: String(result.response.entityId), title: task.title, block_date: today, start_time: fmt(placedStart), end_time: fmt(endMin) }, minutes);
        }
      }
      showActionResult({ title: "Tugas → Agenda", message: placed.length ? `${placed.length} tugas mendapat slot waktu hari ini.` : "Tidak ditemukan ruang waktu yang cocok.", items: placed, tone: placed.length ? "success" : "warning" });
      await load();
    } catch (error) {
      showActionResult({ title: "Tugas → Agenda gagal", message: error instanceof Error ? error.message : "Terjadi kesalahan.", items: [], tone: "warning" });
    } finally { setQuickAction(null); }
  }

  async function createAgendaReminders() {
    if (quickAction) return;
    setQuickAction("reminders");
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Belum masuk.");
      let minutes = await getDefaultReminderMinutes(supabase, user.id);
      if (minutes <= 0) minutes = 15;
      const created: string[] = [];
      for (const block of todayAgenda.filter((x) => !x.completed_at)) {
        const reminder = await createDefaultScheduleReminder(supabase, user.id, timezone, block, minutes);
        if (reminder) created.push(block.title);
      }
      showActionResult({ title: "Agenda → Pengingat", message: created.length ? `${created.length} agenda sekarang punya pengingat. (${minutes} menit sebelum agenda)` : "Semua agenda hari ini sudah memiliki pengingat atau waktunya sudah lewat.", items: created.slice(0, 6), tone: created.length ? "success" : "info" });
    } catch (error) {
      showActionResult({ title: "Agenda → Pengingat gagal", message: error instanceof Error ? error.message : "Terjadi kesalahan.", items: [], tone: "warning" });
    } finally { setQuickAction(null); }
  }

  async function assistTask(task: Task) {
    if (assistTaskId) return;
    setAssistTaskId(task.id);
    try {
      const res = await fetch("/api/tasks/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Licia belum bisa menyusun langkah.");
      const plan = data?.plan || {};
      const steps = Array.isArray(plan.steps) ? plan.steps.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4) : [];
      const created: string[] = [];
      for (const title of steps) {
        const result = await mutateEntity({ entityType: "subtask", operation: "create", payload: { task_id: task.id, title } });
        if (result.ok) created.push(title);
      }
      showActionResult({ title: "Licia menyusun tugas", message: plan.summary || "Langkah tugas sudah disusun langsung tanpa membuka Chat.", items: created.length ? created : steps, tone: created.length ? "success" : "info" });
      await load();
    } catch (error) {
      showActionResult({ title: "Licia belum bisa menyusun tugas", message: error instanceof Error ? error.message : "Terjadi kesalahan.", items: [], tone: "warning" });
    } finally { setAssistTaskId(null); }
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
  const priorityItems = priorityPlan?.priorities ?? [];
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
                  <button onClick={() => void assistTask(task)} disabled={assistTaskId===task.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-accent/15 bg-accent/5 px-3 text-xs font-semibold text-accent transition hover:-translate-y-0.5 disabled:opacity-60"><Sparkles size={13} /> {assistTaskId===task.id?"Menyusun…":"Susun dengan Licia"}</button>
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
              <button onClick={() => void runPriorityPlan()} disabled={Boolean(quickAction)} className="group inline-flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-accent px-3.5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"><span className="flex min-w-0 items-center gap-2">{quickAction === "priority" ? <Loader2 size={15} className="shrink-0 animate-spin" /> : <Sparkles size={15} className="shrink-0" />} Prioritas langsung dengan Licia</span><ArrowRight size={14} className="shrink-0 transition group-hover:translate-x-1" /></button>
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
            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-accent">Tambah cepat</p><TextInput id="task-capture-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="Apa yang perlu kamu selesaikan?" className="mt-2 h-12 rounded-2xl bg-bg text-[15px]" /></div>
            <div className="grid gap-2 sm:grid-cols-3 xl:w-[440px]"><input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs text-text" /><input type="time" value={form.due_time} onChange={(event) => setForm({ ...form, due_time: event.target.value })} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs text-text" /><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Task["priority"] })} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs font-semibold text-text"><option value="low">Prioritas rendah</option><option value="medium">Prioritas sedang</option><option value="high">Prioritas tinggi</option></select></div>
            <PrimaryButton onClick={addTask} disabled={saving} className="h-12 shrink-0 rounded-2xl px-5">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {saving ? "Menyimpan…" : "Tambah tugas"}</PrimaryButton>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-[10px] text-textMuted">Enter langsung menyimpan. Detail seperti project, area, durasi, dan konteks bisa ditambahkan setelahnya.</span><button onClick={() => { setForm((current) => ({ ...current, title: "", description: "" })); setComposerOpen(true); window.setTimeout(() => document.getElementById("task-capture-title")?.focus(), 30); }} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-accent hover:underline"><ArrowRight size={12} /> Tambah langsung di sini</button></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={() => setForm({ ...form, title: "Selesaikan tugas terpenting hari ini", priority: "high" })} className="rounded-xl border border-border bg-bg p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/30"><b className="text-xs text-text">Prioritas hari ini</b><span className="mt-1 block text-[10px] text-textMuted">Isi cepat untuk pekerjaan paling penting.</span></button><button onClick={() => setForm({ ...form, title: "Tindak lanjuti agenda berikutnya", description: "Tindak lanjut dari agenda kalender.", priority: "medium" })} className="rounded-xl border border-border bg-bg p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/30"><b className="text-xs text-text">Follow-up agenda</b><span className="mt-1 block text-[10px] text-textMuted">Cocok untuk hasil rapat, kelas, atau janji.</span></button><button onClick={() => void runPriorityPlan()} disabled={Boolean(quickAction)} className="rounded-xl border border-accent/15 bg-accent/5 p-3 text-left transition hover:-translate-y-0.5 disabled:opacity-60"><b className="text-xs text-accent">Susun dengan Licia</b><span className="mt-1 block text-[10px] text-textMuted">Langsung susun prioritas tanpa membuka Chat.</span></button></div>
        </Card>
      )}

      {priorityItems.length ? <Card className="border-accent/15 bg-accent/5 p-4 animate-licia-slide-in"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-accent">Susunan prioritas siap</p><h3 className="mt-1 font-display text-xl text-text">Licia sudah menyusun langkahnya.</h3><p className="mt-1 text-xs leading-relaxed text-textMuted">{priorityPlan?.focus || "Mulai dari pekerjaan yang paling berdampak dan paling dekat dengan waktunya."}</p></div><button onClick={()=>setPriorityPlan(null)} className="touch-target rounded-lg text-textMuted hover:text-text" aria-label="Tutup hasil prioritas"><X size={14}/></button></div><div className="mt-3 space-y-2">{priorityItems.map((item,index)=><div key={`${item.title}-${index}`} className="rounded-2xl border border-border bg-surface p-3"><div className="flex items-start gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">{index+1}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">{item.title}</p>{item.reason&&<p className="mt-0.5 text-[10px] leading-relaxed text-textMuted">{item.reason}</p>}{item.action&&<p className="mt-1 text-[10px] font-semibold text-accent">Langkah: {item.action}</p>}</div>{item.estimated_minutes ? <span className="shrink-0 rounded-full bg-bg px-2 py-1 text-[9px] text-textMuted">{item.estimated_minutes} mnt</span> : null}</div></div>)}</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void scheduleOpenTasks(priorityItems.map(item=>item.id).filter((id): id is string => Boolean(id)))} disabled={Boolean(quickAction)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-accent px-3 text-[10px] font-semibold text-white">Jadwalkan prioritas</button><Link href="/focus" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-bg px-3 text-[10px] font-semibold text-textMuted hover:text-accent">Mulai fokus</Link></div></Card> : actionResult && <Card className={clsx("border-accent/15 bg-accent/5 p-4 animate-licia-slide-in", actionResult.tone === "warning" && "border-danger/15 bg-danger/5", actionResult.tone === "success" && "border-success/15 bg-success/5")}><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><CheckCircle2 size={16}/></span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-accent">{actionResult.title}</p><p className="mt-1 text-xs leading-relaxed text-textMuted">{actionResult.message}</p>{actionResult.items.length>0&&<div className="mt-2 flex flex-wrap gap-1.5">{actionResult.items.slice(0,6).map((item)=><span key={item} className="rounded-full border border-border bg-surface px-2.5 py-1 text-[9px] font-semibold text-text">{item}</span>)}</div>}</div><button onClick={()=>setActionResult(null)} className="touch-target rounded-lg text-textMuted hover:text-text" aria-label="Tutup hasil"><X size={14}/></button></div></Card>}
      <section className="task-bridge-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: CalendarDays, label: "Agenda → Tugas", text: "Jadikan agenda hari ini sebagai tugas yang langsung terhubung.", action: convertAgendaToTasks, busy: "agenda-task" },
          { icon: Inbox, label: "Inbox → Tugas", text: "Ubah tangkapan Inbox terbuka menjadi tugas nyata.", action: convertInboxToTasks, busy: "inbox-task" },
          { icon: CalendarClock, label: "Tugas → Agenda", text: "Cari celah waktu hari ini dan jadwalkan tugas terbuka.", action: scheduleOpenTasks, busy: "task-agenda" },
          { icon: AlarmClock, label: "Agenda → Pengingat", text: "Buat pengingat untuk agenda hari ini tanpa membuka halaman lain.", action: createAgendaReminders, busy: "reminders" },
        ].map((item, index) => { const Icon = item.icon; const busy = quickAction === item.busy; return <button key={item.label} onClick={() => void item.action()} disabled={Boolean(quickAction)} style={{ animationDelay: `${index * 60}ms` }} className="task-bridge-card group flex min-w-0 items-center gap-3 rounded-[1.35rem] border border-border bg-surface p-3.5 text-left animate-licia-card-in disabled:cursor-wait disabled:opacity-60"><span className="shrink-0 rounded-2xl bg-accent/10 p-2.5 text-accent transition group-hover:scale-110">{busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}</span><span className="min-w-0 flex-1"><b className="block break-words text-xs text-text">{item.label}</b><span className="mt-0.5 block break-words text-[9px] leading-relaxed text-textMuted">{item.text}</span></span><ArrowRight size={13} className="shrink-0 text-textMuted transition group-hover:translate-x-1 group-hover:text-accent" /></button>; })}
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
          <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><Target size={15} className="text-accent" /><h3 className="font-display text-lg text-text">Hubungkan dengan Life OS</h3></div><div className="mt-3 grid gap-2">{[{ href: "/calendar", label: "Kalender", text: "Jadikan slot waktu menjadi tindakan nyata." }, { href: "/inbox", label: "Smart Inbox", text: "Pindahkan ide mentah menjadi tugas yang bisa dieksekusi." }, { href: "/goals-projects", label: "Target & Proyek", text: "Tempelkan pekerjaan ke tujuan yang lebih besar." }].map((item) => <a key={item.href} href={item.href} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-bg p-3 transition hover:-translate-y-0.5 hover:border-accent/25"><span className="min-w-0 flex-1"><b className="block text-xs text-text">{item.label}</b><span className="mt-0.5 block break-words text-[10px] leading-relaxed text-textMuted">{item.text}</span></span><ArrowRight size={14} className="shrink-0 text-accent" /></a>)}</div><a href="/guide" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-accent hover:underline">Pelajari semua alur di Panduan <ArrowRight size={12} /></a></Card>
        </div>
      </section>
    </div>
  );
}
