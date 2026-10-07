"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Grid2X2,
  CalendarRange,
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
import { Card, EmptyState, PrimaryButton, TextInput, notifyToast, Chip } from "@/components/ui";
import { dateStrInTimezone, localDateTimeToIso } from "@/lib/date";
import { TaskKanban, TaskMatrix, TaskWeek } from "@/components/tasks/TaskViews";
import { inversePatch, stepFocus, taskKeyAction, type TaskPatch, type ViewTask } from "@/lib/tasks/views";
import { deferDestructive, toastWithUndo } from "@/lib/ui/undoToast";
import { isTypingTarget } from "@/lib/shortcuts";
import { useLanguage } from "@/components/LanguageProvider";
import {
  createDefaultScheduleReminder,
  createDefaultTaskReminder,
  getDefaultReminderMinutes,
  syncExistingTaskReminder,
} from "@/lib/reminders/schedule";

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
type AgendaRow = {
  id: string;
  title: string;
  block_date: string;
  start_time: string;
  end_time: string;
  task_id: string | null;
  project_id: string | null;
  description: string | null;
  location: string | null;
  completed_at: string | null;
  version?: number | null;
  updated_at?: string | null;
};
type InboxRow = {
  id: string;
  content: string;
  ai_suggestion: any;
  status: string;
  linked_task_id: string | null;
  version?: number | null;
  updated_at?: string | null;
};
type TaskActionResult = { title: string; message: string; items: string[]; tone?: "success" | "info" | "warning" };
type LayoutMode = "list" | "board" | "matrix" | "week";
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

function formatDue(value: string, timezone: string, locale = "id-ID") {
  return new Intl.DateTimeFormat(locale, {
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

type Translate = (key: string, params?: Record<string, string | number | null | undefined>) => string;

function relativeDue(value: string, tr: Translate) {
  const delta = new Date(value).getTime() - Date.now();
  const minutes = Math.round(Math.abs(delta) / 60000);
  if (minutes < 60) return delta < 0 ? tr("{n} mnt terlambat", { n: minutes }) : tr("{n} mnt lagi", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return delta < 0 ? tr("{n} jam terlambat", { n: hours }) : tr("{n} jam lagi", { n: hours });
  const days = Math.round(hours / 24);
  return delta < 0 ? tr("{n} hari terlambat", { n: days }) : tr("{n} hari lagi", { n: days });
}

export default function TasksPage() {
  const { t: trn } = useLanguage();
  const { t: tr, locale } = useLanguage();
  const { t } = useLanguage();
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
  const [layout, setLayout] = useState<LayoutMode>("list");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(-1);
  const tasksRef = useRef<Task[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [customDueDate, setCustomDueDate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  tasksRef.current = tasks;
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
  const [priorityPlan, setPriorityPlan] = useState<{
    focus?: string;
    priorities?: Array<{
      id?: string;
      title: string;
      reason?: string;
      action?: string;
      estimated_minutes?: number | null;
    }>;
  } | null>(null);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const resolvedTimezone =
      (await supabase.from("users").select("timezone").eq("id", user.id).single()).data?.timezone ?? "Asia/Jakarta";
    const todayStr = dateStrInTimezone(new Date(), resolvedTimezone);
    const [{ data: taskData }, { data: projectData }, { data: areaData }, { data: agendaData }, { data: inboxData }] =
      await Promise.all([
        supabase
          .from("tasks")
          .select(
            "id,title,description,status,priority,due_at,estimated_minutes,project_id,area_id,version,updated_at,subtasks(id,title,status)",
          )
          .order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("projects").select("id,name").eq("status", "active").order("name"),
        supabase.from("areas").select("id,name,icon").order("name"),
        supabase
          .from("schedule_blocks")
          .select(
            "id,title,block_date,start_time,end_time,task_id,project_id,description,location,completed_at,version,updated_at",
          )
          .eq("user_id", user.id)
          .eq("block_date", todayStr)
          .order("start_time", { ascending: true }),
        supabase
          .from("smart_inbox_items")
          .select("id,content,ai_suggestion,status,linked_task_id,version,updated_at")
          .eq("user_id", user.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(20),
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
      if (savedView === "board" || savedView === "list" || savedView === "matrix" || savedView === "week")
        setLayout(savedView);
      if (savedSort === "next" || savedSort === "priority" || savedSort === "effort") setSort(savedSort);
      setForm((current) => ({
        ...current,
        estimated_minutes:
          savedMinutes && Number(savedMinutes) > 0
            ? String(Math.min(480, Number(savedMinutes)))
            : current.estimated_minutes,
        priority:
          savedPriority === "low" || savedPriority === "medium" || savedPriority === "high"
            ? savedPriority
            : current.priority,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      notifyToast({
        title: "Tugas belum tersimpan",
        message: result.error || "Perubahan gagal disimpan.",
        tone: "error",
      });
      setSaving(false);
      return;
    }
    const createdRecord = result.response?.record;
    const createdTaskId = String(result.response?.entityId || createdRecord?.id || "");
    if (createdTaskId) {
      const dueAt = dueIso(form.due_date, form.due_time);
      if (dueAt && navigator.onLine) {
        const minutes = await getDefaultReminderMinutes(supabase, user.id);
        if (minutes > 0)
          await createDefaultTaskReminder(
            supabase,
            user.id,
            timezone,
            { id: createdTaskId, title, due_at: dueAt },
            minutes,
          );
      }
    }
    setCreatedId(createdTaskId || null);
    window.setTimeout(() => setCreatedId((current) => (current === createdTaskId ? null : current)), 1100);
    setForm((current) => ({
      ...current,
      title: "",
      description: "",
      due_date: "",
      due_time: "",
      project_id: "",
      area_id: "",
    }));
    if (result.queued) {
      const optimistic: Task = {
        id: createdTaskId,
        title,
        description: form.description.trim() || null,
        status: "todo",
        priority: form.priority,
        due_at: dueIso(form.due_date, form.due_time),
        estimated_minutes: Number(form.estimated_minutes) || null,
        project_id: form.project_id || null,
        area_id: form.area_id || null,
        version: 1,
        updated_at: new Date().toISOString(),
        subtasks: [],
      };
      setTasks((current) => [optimistic, ...current]);
      notifyToast({
        title: "Tugas disimpan offline",
        message: "Akan disinkronkan saat koneksi kembali.",
        tone: "info",
      });
    } else {
      notifyToast({ title: "Tugas ditambahkan ✨", message: title, tone: "success" });
      await load();
    }
    setSaving(false);
  }

  async function setStatus(task: Task, status: Task["status"], quiet = false) {
    const previousStatus = task.status;
    const result = await mutateEntity({
      entityType: "task",
      operation: "update",
      entityId: task.id,
      baseVersion: task.version ?? null,
      clientUpdatedAt: task.updated_at ?? null,
      payload: { status },
    });
    if (!result.ok) {
      notifyToast({
        title: result.conflict ? trn("Perubahan bertabrakan") : trn("Status belum berubah"),
        message: result.conflict
          ? trn("Tinjau konflik sinkronisasi di Pusat Sinkronisasi.")
          : result.error || "Perubahan gagal disimpan.",
        tone: "error",
      });
      return;
    }
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status,
              version: (result.response?.record?.version as number) ?? item.version,
              updated_at: String(result.response?.record?.updated_at || new Date().toISOString()),
            }
          : item,
      ),
    );
    if (quiet) {
      notifyToast({ title: "Dibatalkan", message: task.title, tone: "info", duration: 1800 });
    } else {
      if (status === "done" && !result.queued) setCompletedId(task.id);
      if (status === "done")
        window.setTimeout(() => setCompletedId((current) => (current === task.id ? null : current)), 850);
      // A6: aksi cepat bisa diurungkan 5 detik tanpa dialog konfirmasi.
      toastWithUndo({
        title: status === "done" ? t("Tugas selesai ✨") : t("Status tugas diperbarui"),
        message: task.title,
        undoLabel: t("Urungkan"),
        revert: async () => {
          const latest = tasksRef.current.find((item) => item.id === task.id);
          if (latest) await setStatus(latest, previousStatus, true);
        },
      });
    }
    await load();
  }

  /** Perubahan banyak-bidang dari seret-lepas (Kanban / Matriks / Minggu). Selalu bisa diurungkan. */
  async function patchTask(viewTask: ViewTask, patch: TaskPatch, summary: string) {
    const task = tasksRef.current.find((item) => item.id === viewTask.id);
    if (!task) return;
    const before = inversePatch(task, patch);
    const result = await mutateEntity({
      entityType: "task",
      operation: "update",
      entityId: task.id,
      baseVersion: task.version ?? null,
      clientUpdatedAt: task.updated_at ?? null,
      payload: { ...patch },
    });
    if (!result.ok) {
      notifyToast({
        title: result.conflict ? trn("Perubahan bertabrakan") : trn("Tugas belum dipindah"),
        message: result.conflict
          ? trn("Tinjau konflik sinkronisasi di Pusat Sinkronisasi.")
          : result.error || "Perubahan gagal disimpan.",
        tone: "error",
      });
      return;
    }
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              ...patch,
              version: (result.response?.record?.version as number) ?? item.version,
              updated_at: String(result.response?.record?.updated_at || new Date().toISOString()),
            }
          : item,
      ),
    );
    if (patch.due_at && !result.queued) {
      try {
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (uid)
          await syncExistingTaskReminder(supabase, uid, timezone, {
            id: task.id,
            title: task.title,
            due_at: patch.due_at,
          });
      } catch {}
    }
    toastWithUndo({
      title: summary,
      message: task.title,
      undoLabel: t("Urungkan"),
      revert: async () => {
        const latest = tasksRef.current.find((item) => item.id === task.id);
        if (!latest) return;
        const back = await mutateEntity({
          entityType: "task",
          operation: "update",
          entityId: latest.id,
          baseVersion: latest.version ?? null,
          clientUpdatedAt: latest.updated_at ?? null,
          payload: { ...before },
        });
        if (!back.ok)
          notifyToast({
            title: "Belum bisa dibatalkan",
            message: back.error || "Perubahan gagal disimpan.",
            tone: "error",
          });
        await load();
      },
    });
    await load();
  }

  async function toggleSub(sub: Subtask) {
    const result = await mutateEntity({
      entityType: "subtask",
      operation: "update",
      entityId: sub.id,
      payload: { status: sub.status === "done" ? "todo" : "done" },
    });
    if (!result.ok) {
      notifyToast({
        title: "Langkah belum berubah",
        message: result.error || "Perubahan gagal disimpan.",
        tone: "error",
      });
      return;
    }
    await load();
  }

  async function addSubtask(taskId: string) {
    const title = (newSub[taskId] ?? "").trim();
    if (!title) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const result = await mutateEntity({
      entityType: "subtask",
      operation: "create",
      payload: { task_id: taskId, title },
    });
    if (!result.ok) {
      notifyToast({
        title: "Langkah belum ditambahkan",
        message: result.error || "Perubahan gagal disimpan.",
        tone: "error",
      });
      return;
    }
    setNewSub((current) => ({ ...current, [taskId]: "" }));
    notifyToast({ title: "Langkah ditambahkan", message: title, tone: "success" });
    await load();
  }

  /** A6: penghapusan ditunda 5 detik; item disembunyikan lebih dulu dan bisa dikembalikan lewat Urungkan. */
  function deleteTask(id: string) {
    const target = tasksRef.current.find((task) => task.id === id);
    if (!target || hiddenIds.has(id)) return;
    deferDestructive({
      id: `task:${id}`,
      title: t("Tugas dihapus"),
      message: target.title,
      undoLabel: t("Urungkan"),
      hide: () => {
        setExpandedId(null);
        setHiddenIds((current) => new Set(current).add(id));
      },
      restore: () =>
        setHiddenIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        }),
      commit: async () => {
        const latest = tasksRef.current.find((task) => task.id === id) ?? target;
        const result = await mutateEntity({
          entityType: "task",
          operation: "delete",
          entityId: id,
          baseVersion: latest.version ?? null,
          clientUpdatedAt: latest.updated_at ?? null,
          payload: {},
        });
        if (!result.ok) {
          setHiddenIds((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
          notifyToast({
            title: result.conflict ? trn("Tugas berubah di perangkat lain") : trn("Tugas belum terhapus"),
            message: result.conflict
              ? trn("Tinjau konflik sebelum menghapus data.")
              : result.error || "Perubahan gagal disimpan.",
            tone: "error",
          });
          return;
        }
        setTasks((current) => current.filter((item) => item.id !== id));
        setHiddenIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        if (!result.queued) await load();
      },
    });
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
      notifyToast({
        title: result.conflict ? trn("Perubahan bertabrakan") : trn("Perubahan belum tersimpan"),
        message: result.conflict
          ? trn("Tinjau konflik di Pusat Sinkronisasi.")
          : result.error || "Perubahan gagal disimpan.",
        tone: "error",
      });
      setSavingId(null);
      return;
    }
    const savedDue = dueIso(editForm.due_date, editForm.due_time);
    if (savedDue && !result.queued) {
      const updatedTask = { id, title: editForm.title.trim(), due_at: savedDue };
      const synced = await syncExistingTaskReminder(
        supabase,
        (await supabase.auth.getUser()).data.user?.id || "",
        timezone,
        updatedTask,
      );
      if (!synced) {
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (uid) {
          const minutes = await getDefaultReminderMinutes(supabase, uid);
          if (minutes > 0) await createDefaultTaskReminder(supabase, uid, timezone, updatedTask, minutes);
        }
      }
    } else if (!result.queued) {
    }
    setEditingId(null);
    setSavingId(null);
    if (result.queued) {
      setTasks((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                title: editForm.title.trim(),
                description: editForm.description.trim() || null,
                priority: editForm.priority,
                due_at: dueIso(editForm.due_date, editForm.due_time),
                estimated_minutes: Number(editForm.estimated_minutes) || null,
                project_id: editForm.project_id || null,
                area_id: editForm.area_id || null,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      notifyToast({
        title: "Perubahan disimpan offline",
        message: "Akan disinkronkan saat koneksi kembali.",
        tone: "info",
      });
    } else {
      notifyToast({ title: "Tugas diperbarui", message: editForm.title.trim(), tone: "success" });
      await load();
    }
  }

  function showActionResult(result: TaskActionResult) {
    setActionResult(result);
    window.setTimeout(() => setActionResult((current) => (current === result ? null : current)), 7000);
  }

  async function runPriorityPlan() {
    if (quickAction) return;
    setQuickAction("priority");
    try {
      const response = await fetch("/api/v38/daily-plan?refresh=1", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.plan) throw new Error(data.error || tr("Rencana prioritas belum tersedia."));
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
        const result = await mutateEntity({
          entityType: "task",
          operation: "update",
          entityId: current.id,
          baseVersion: current.version ?? null,
          clientUpdatedAt: current.updated_at ?? null,
          payload: { priority: desired },
        });
        if (result.ok) changed.push(current.title);
      }
      setPriorityPlan({
        focus: plan.focus,
        priorities: proposed.map((item: any) => ({
          id: item.id ? String(item.id) : undefined,
          title: String(item.title || ""),
          reason: item.reason,
          estimated_minutes: item.estimated_minutes,
        })),
      });
      showActionResult({
        title: tr("Prioritas dengan Licia"),
        message: changed.length
          ? tr("{changed_length} tugas langsung diperbarui tingkat prioritasnya.", { changed_length: changed.length })
          : tr("Licia sudah menyusun prioritas. Tidak ada tingkat prioritas yang perlu dinaikkan."),
        items: changed.slice(0, 6),
        tone: "success",
      });
    } catch (error) {
      showActionResult({
        title: tr("Prioritas belum tersusun"),
        message: error instanceof Error ? error.message : tr("Coba lagi sebentar."),
        items: [],
        tone: "warning",
      });
    } finally {
      setQuickAction(null);
    }
  }

  async function convertAgendaToTasks() {
    if (quickAction) return;
    setQuickAction("agenda-task");
    try {
      const candidates = todayAgenda.filter((block) => !block.task_id && !block.completed_at).slice(0, 12);
      if (!candidates.length) {
        showActionResult({
          title: tr("Agenda → Tugas"),
          message: tr("Tidak ada agenda hari ini yang belum terhubung ke tugas."),
          items: [],
          tone: "info",
        });
        return;
      }
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error(tr("Belum masuk."));
      const created: string[] = [];
      for (const block of candidates) {
        const startMin = Number(block.start_time.slice(0, 2)) * 60 + Number(block.start_time.slice(3, 5));
        const endMin = Number(block.end_time.slice(0, 2)) * 60 + Number(block.end_time.slice(3, 5));
        const description = [
          block.description,
          block.location ? `Lokasi: ${block.location}` : null,
          tr("Dibuat dari agenda {block_date} {slice}–{slice2}.", {
            block_date: block.block_date,
            slice: block.start_time.slice(0, 5),
            slice2: block.end_time.slice(0, 5),
          }),
        ]
          .filter(Boolean)
          .join("\n");
        const result = await mutateEntity({
          entityType: "task",
          operation: "create",
          payload: {
            title: block.title,
            description: description || null,
            priority: "medium",
            status: "todo",
            due_at: localDateTimeToIso(block.block_date, block.end_time.slice(0, 5), timezone),
            estimated_minutes: Math.max(1, endMin - startMin),
            project_id: block.project_id || null,
          },
        });
        if (!result.ok || !result.response?.entityId) continue;
        const link = await mutateEntity({
          entityType: "schedule",
          operation: "update",
          entityId: block.id,
          baseVersion: block.version ?? null,
          clientUpdatedAt: block.updated_at ?? null,
          payload: { task_id: result.response.entityId },
        });
        if (!link.ok) {
          await mutateEntity({ entityType: "task", operation: "delete", entityId: String(result.response.entityId) });
          continue;
        }
        created.push(block.title);
        const reminderMinutes = await getDefaultReminderMinutes(supabase, user.id);
        if (reminderMinutes > 0)
          await createDefaultTaskReminder(
            supabase,
            user.id,
            timezone,
            {
              id: String(result.response.entityId),
              title: block.title,
              due_at: localDateTimeToIso(block.block_date, block.end_time.slice(0, 5), timezone),
            },
            reminderMinutes,
          );
      }
      showActionResult({
        title: tr("Agenda → Tugas"),
        message: created.length
          ? tr("{created_length} agenda langsung dijadikan tugas.", { created_length: created.length })
          : tr("Tidak ada agenda yang berhasil diproses."),
        items: created.slice(0, 6),
        tone: created.length ? "success" : "warning",
      });
      await load();
    } catch (error) {
      showActionResult({
        title: tr("Agenda → Tugas gagal"),
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        items: [],
        tone: "warning",
      });
    } finally {
      setQuickAction(null);
    }
  }

  async function convertInboxToTasks() {
    if (quickAction) return;
    setQuickAction("inbox-task");
    try {
      const candidates = openInbox.filter((item) => !item.linked_task_id).slice(0, 8);
      if (!candidates.length) {
        showActionResult({
          title: tr("Inbox → Tugas"),
          message: tr("Tidak ada item Inbox terbuka yang siap diubah menjadi tugas."),
          items: [],
          tone: "info",
        });
        return;
      }
      const created: string[] = [];
      for (const item of candidates) {
        const suggestion = item.ai_suggestion && typeof item.ai_suggestion === "object" ? item.ai_suggestion : {};
        const result = await mutateEntity({
          entityType: "task",
          operation: "create",
          payload: {
            title: suggestion.title || item.content,
            priority: suggestion.priority || "medium",
            due_at: suggestion.due_at || null,
            status: "todo",
          },
        });
        if (!result.ok || !result.response?.entityId) continue;
        const marked = await mutateEntity({
          entityType: "inbox",
          operation: "update",
          entityId: item.id,
          baseVersion: item.version ?? null,
          clientUpdatedAt: item.updated_at ?? null,
          payload: {
            kind: "task",
            status: "processed",
            linked_task_id: result.response.entityId,
            processed_at: new Date().toISOString(),
          },
        });
        if (!marked.ok) {
          await mutateEntity({ entityType: "task", operation: "delete", entityId: String(result.response.entityId) });
          continue;
        }
        created.push(String(suggestion.title || item.content).slice(0, 90));
      }
      showActionResult({
        title: tr("Inbox → Tugas"),
        message: created.length
          ? tr("{created_length} item Inbox dipindahkan menjadi tugas.", { created_length: created.length })
          : tr("Tidak ada item yang berhasil diproses."),
        items: created.slice(0, 6),
        tone: created.length ? "success" : "warning",
      });
      await load();
    } catch (error) {
      showActionResult({
        title: tr("Inbox → Tugas gagal"),
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        items: [],
        tone: "warning",
      });
    } finally {
      setQuickAction(null);
    }
  }

  async function scheduleOpenTasks(preferredIds?: string[]) {
    if (quickAction) return;
    setQuickAction("task-agenda");
    try {
      const busy = todayAgenda
        .filter((block) => !block.completed_at)
        .map((block) => {
          const start = Number(block.start_time.slice(0, 2)) * 60 + Number(block.start_time.slice(3, 5));
          const end = Number(block.end_time.slice(0, 2)) * 60 + Number(block.end_time.slice(3, 5));
          return { start, end };
        });
      const preferredSet = new Set(preferredIds || []);
      const sourceTasks = preferredSet.size ? tasks.filter((task) => preferredSet.has(task.id)) : tasks;
      const candidates = sourceTasks
        .filter((task) => task.status !== "done" && !task.due_at)
        .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])
        .slice(0, 3);
      if (!candidates.length) {
        showActionResult({
          title: tr("Tugas → Agenda"),
          message: tr("Tidak ada tugas terbuka tanpa jadwal yang perlu ditempatkan."),
          items: [],
          tone: "info",
        });
        return;
      }
      const placed: string[] = [];
      const slotDuration = (task: Task) => Math.max(25, Math.min(90, task.estimated_minutes || 30));
      const localClock = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      const [clockHour, clockMinute] = localClock.split(":").map(Number);
      let cursor = Math.max(8 * 60, clockHour * 60 + clockMinute + 15);
      const overlap = (start: number, end: number) => busy.some((x) => start < x.end && end > x.start);
      for (const task of candidates) {
        let placedStart = -1;
        const duration = slotDuration(task);
        for (let startMin = cursor; startMin <= 21 * 60 - duration; startMin += 15) {
          if (!overlap(startMin, startMin + duration)) {
            placedStart = startMin;
            break;
          }
        }
        if (placedStart < 0) continue;
        const endMin = placedStart + duration;
        const fmt = (v: number) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
        const result = await mutateEntity({
          entityType: "schedule",
          operation: "create",
          payload: {
            block_date: today,
            start_time: fmt(placedStart),
            end_time: fmt(endMin),
            title: task.title,
            description: tr("Dibuat dari Tugas → Agenda."),
            task_id: task.id,
            project_id: task.project_id || null,
            created_by: "manual",
          },
        });
        if (!result.ok || !result.response?.entityId) continue;
        placed.push(`${fmt(placedStart)} · ${task.title}`);
        busy.push({ start: placedStart, end: endMin });
        cursor = endMin + 15;
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          const minutes = await getDefaultReminderMinutes(supabase, user.id);
          if (minutes > 0)
            await createDefaultScheduleReminder(
              supabase,
              user.id,
              timezone,
              {
                id: String(result.response.entityId),
                title: task.title,
                block_date: today,
                start_time: fmt(placedStart),
                end_time: fmt(endMin),
              },
              minutes,
            );
        }
      }
      showActionResult({
        title: tr("Tugas → Agenda"),
        message: placed.length
          ? tr("{placed_length} tugas mendapat slot waktu hari ini.", { placed_length: placed.length })
          : tr("Tidak ditemukan ruang waktu yang cocok."),
        items: placed,
        tone: placed.length ? "success" : "warning",
      });
      await load();
    } catch (error) {
      showActionResult({
        title: tr("Tugas → Agenda gagal"),
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        items: [],
        tone: "warning",
      });
    } finally {
      setQuickAction(null);
    }
  }

  async function createAgendaReminders() {
    if (quickAction) return;
    setQuickAction("reminders");
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error(tr("Belum masuk."));
      let minutes = await getDefaultReminderMinutes(supabase, user.id);
      if (minutes <= 0) minutes = 15;
      const created: string[] = [];
      for (const block of todayAgenda.filter((x) => !x.completed_at)) {
        const reminder = await createDefaultScheduleReminder(supabase, user.id, timezone, block, minutes);
        if (reminder) created.push(block.title);
      }
      showActionResult({
        title: tr("Agenda → Pengingat"),
        message: created.length
          ? tr("{created_length} agenda sekarang punya pengingat. ({minutes} menit sebelum agenda)", {
              created_length: created.length,
              minutes,
            })
          : tr("Semua agenda hari ini sudah memiliki pengingat atau waktunya sudah lewat."),
        items: created.slice(0, 6),
        tone: created.length ? "success" : "info",
      });
    } catch (error) {
      showActionResult({
        title: tr("Agenda → Pengingat gagal"),
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        items: [],
        tone: "warning",
      });
    } finally {
      setQuickAction(null);
    }
  }

  async function assistTask(task: Task) {
    if (assistTaskId) return;
    setAssistTaskId(task.id);
    try {
      const res = await fetch("/api/tasks/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || tr("Licia belum bisa menyusun langkah."));
      const plan = data?.plan || {};
      const steps = Array.isArray(plan.steps)
        ? plan.steps
            .map((x: any) => String(x).trim())
            .filter(Boolean)
            .slice(0, 4)
        : [];
      const created: string[] = [];
      for (const title of steps) {
        const result = await mutateEntity({
          entityType: "subtask",
          operation: "create",
          payload: { task_id: task.id, title },
        });
        if (result.ok) created.push(title);
      }
      showActionResult({
        title: tr("Licia menyusun tugas"),
        message: plan.summary || tr("Langkah tugas sudah disusun langsung tanpa membuka Chat."),
        items: created.length ? created : steps,
        tone: created.length ? "success" : "info",
      });
      await load();
    } catch (error) {
      showActionResult({
        title: tr("Licia belum bisa menyusun tugas"),
        message: error instanceof Error ? error.message : "Terjadi kesalahan.",
        items: [],
        tone: "warning",
      });
    } finally {
      setAssistTaskId(null);
    }
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
    return tasks
      .filter((task) => {
        if (hiddenIds.has(task.id)) return false;
        if (!showDone && filter !== "done" && task.status === "done") return false;
        if (filter === "done" && task.status !== "done") return false;
        if (filter === "next" && (task.status === "done" || !task.due_at)) return false;
        if (filter === "today" && (!task.due_at || dayOnly(task.due_at, timezone) !== today || task.status === "done"))
          return false;
        if (filter === "unscheduled" && (task.status === "done" || task.due_at)) return false;
        if (filter === "high" && (task.priority !== "high" || task.status === "done")) return false;
        return !q || `${task.title} ${task.description ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sort === "priority")
          return { high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority];
        if (sort === "effort") return (a.estimated_minutes ?? 9999) - (b.estimated_minutes ?? 9999);
        if (!a.due_at && !b.due_at) return 0;
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
  }, [tasks, showDone, filter, search, sort, timezone, today, hiddenIds]);

  const projectName = (id: string | null) => (id ? projects.find((project) => project.id === id)?.name : null);
  const areaName = (id: string | null) => (id ? areas.find((area) => area.id === id)?.name : null);
  const shortTasks = filtered
    .filter((task) => task.status !== "done" && (task.estimated_minutes ?? 999) <= 30)
    .slice(0, 3);
  const priorityItems = priorityPlan?.priorities ?? [];
  const filterItems: Array<{ id: FilterMode; label: string }> = [
    { id: "all", label: "Semua" },
    { id: "today", label: tr("Hari ini") },
    { id: "next", label: "Bertenggat" },
    { id: "high", label: "Prioritas tinggi" },
    { id: "unscheduled", label: "Tanpa tanggal" },
    { id: "done", label: "Selesai" },
  ];

  /** Dari Kanban/Matriks/Pekan: buka tugas itu di tampilan daftar dengan detail terbuka. */
  function openFromView(viewTask: ViewTask) {
    setLayout("list");
    setShowDone(true);
    setExpandedId(viewTask.id);
    const idx = filtered.findIndex((task) => task.id === viewTask.id);
    setFocusIndex(idx);
    window.setTimeout(
      () => document.getElementById(`task-${viewTask.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      80,
    );
  }

  // A12: pintasan daftar tugas (J/K, X, E, Enter, #). Tidak aktif saat mengetik atau saat dialog terbuka.
  const keyState = useRef({ filtered, focusIndex, layout, expandedId });
  keyState.current = { filtered, focusIndex, layout, expandedId };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = keyState.current;
      if (state.layout !== "list" || event.defaultPrevented) return;
      if (isTypingTarget(event.target) || document.querySelector('[aria-modal="true"]')) return;
      const action = taskKeyAction(event.key, { ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey });
      if (!action) return;
      const onInteractive =
        event.target instanceof HTMLElement && Boolean(event.target.closest("button, a, summary, select"));
      // Enter/Space milik tombol yang sedang terfokus; jangan dibajak.
      if ((action === "open" || action === "toggle" || action === "edit" || action === "delete") && onInteractive)
        return;
      if (action === "next" || action === "prev" || action === "first" || action === "last") {
        if (onInteractive && (event.key === "ArrowDown" || event.key === "ArrowUp")) return;
        event.preventDefault();
        const next = stepFocus(state.focusIndex, action, state.filtered.length);
        setFocusIndex(next);
        const target = state.filtered[next];
        if (target)
          document.getElementById(`task-${target.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      const current = state.filtered[state.focusIndex];
      if (!current) return;
      event.preventDefault();
      if (action === "toggle") void setStatus(current, current.status === "done" ? "todo" : "done");
      else if (action === "edit") startEdit(current);
      else if (action === "open") setExpandedId(state.expandedId === current.id ? null : current.id);
      else if (action === "delete") deleteTask(current.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (focusIndex >= filtered.length) setFocusIndex(filtered.length - 1);
  }, [filtered.length, focusIndex]);

  const TaskCard = ({ task, index }: { task: Task; index: number }) => {
    const expanded = expandedId === task.id;
    const editing = editingId === task.id;
    const meta = statusMeta[task.status];
    const StatusIcon = meta.icon;
    const overdue = Boolean(task.due_at && task.status !== "done" && new Date(task.due_at).getTime() < Date.now());
    const completedSubtasks = task.subtasks.filter((sub) => sub.status === "done").length;
    const progress = task.subtasks.length ? Math.round((completedSubtasks / task.subtasks.length) * 100) : 0;
    const focused = focusIndex >= 0 && filtered[focusIndex]?.id === task.id;

    return (
      <article
        id={`task-${task.id}`}
        data-focused={focused ? "true" : undefined}
        aria-current={focused ? "true" : undefined}
        className={clsx(
          focused && "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg",
          "task-modern-card group relative overflow-hidden rounded-xl border bg-surface p-3 shadow-sm sm:p-3.5",
          "transition-[box-shadow,border-color] duration-180",
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
            aria-label={task.status === "done" ? tr("Tandai belum selesai") : tr("Tandai selesai")}
          >
            <StatusIcon size={22} className={meta.className} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <button onClick={() => setExpandedId(expanded ? null : task.id)} className="min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <p
                    className={clsx(
                      "break-words text-[15px] font-bold leading-snug text-text sm:text-base",
                      task.status === "done" && "text-textMuted line-through",
                    )}
                  >
                    {task.title}
                  </p>
                </div>
                <div className={clsx("mt-1 flex min-w-0 flex-wrap items-center gap-1 text-2xs", overdue ? "text-danger" : "text-textMuted")}>
                  <span>{task.due_at ? formatDue(task.due_at, timezone, locale) : tr("Tanpa tenggat")}</span>
                  {task.estimated_minutes ? <><span>·</span><span>{tr("{estimated_minutes} mnt",{estimated_minutes:task.estimated_minutes})}</span></> : null}
                  <span>·</span><span className={clsx("font-semibold",task.priority==="high"?"text-danger":task.priority==="medium"?"text-accent":"text-textMuted")}>● {priorityLabel[task.priority]}</span>
                </div>
                            <span
                className={clsx(
                  "w-fit shrink-0 rounded-full border px-2.5 py-1 text-2xs font-bold",
                  priorityClass[task.priority],
                )}
              >
                {priorityLabel[task.priority]}
              </span>
            </div>

            {task.subtasks.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-2xs text-textMuted">
                  <span>
                    {tr("{completedSubtasks}/{subtasks_length} langkah", {
                      completedSubtasks,
                      subtasks_length: task.subtasks.length,
                    })}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setExpandedId(expanded ? null : task.id)}
            className="touch-target shrink-0 rounded-xl text-textMuted transition hover:bg-bg hover:text-accent"
            aria-label={expanded ? tr("Tutup detail") : tr("Buka detail")}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {expanded && (
          <div className="mt-5 animate-licia-pop-in border-t border-border pt-4">
            {editing ? (
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <TextInput
                  value={editForm.title}
                  onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                  placeholder={tr("Judul tugas")}
                />
                <select
                  value={editForm.priority}
                  onChange={(event) => setEditForm({ ...editForm, priority: event.target.value as Task["priority"] })}
                  className="min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text"
                >
                  <option value="low">{tr("Rendah")}</option>
                  <option value="medium">{tr("Sedang")}</option>
                  <option value="high">{tr("Tinggi")}</option>
                </select>
                <textarea
                  value={editForm.description}
                  onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                  rows={3}
                  className="resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text sm:col-span-2"
                  placeholder={tr("Konteks / definisi selesai…")}
                />
                <input
                  type="date"
                  value={editForm.due_date}
                  onChange={(event) => setEditForm({ ...editForm, due_date: event.target.value })}
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text"
                />
                <input
                  type="time"
                  value={editForm.due_time}
                  onChange={(event) => setEditForm({ ...editForm, due_time: event.target.value })}
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text"
                />
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={editForm.estimated_minutes}
                  onChange={(event) => setEditForm({ ...editForm, estimated_minutes: event.target.value })}
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text"
                  placeholder={tr("Menit")}
                />
                <select
                  value={editForm.project_id}
                  onChange={(event) => setEditForm({ ...editForm, project_id: event.target.value })}
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text"
                >
                  <option value="">{tr("Tanpa proyek")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select
                  value={editForm.area_id}
                  onChange={(event) => setEditForm({ ...editForm, area_id: event.target.value })}
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text"
                >
                  <option value="">{tr("Tanpa area")}</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.icon || "◉"} {area.name}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-textMuted"
                  >
                    <X size={13} /> {tr("Batal")}
                  </button>
                  <PrimaryButton onClick={() => saveEdit(task.id)} disabled={savingId === task.id} className="text-xs">
                    {savingId === task.id && <Loader2 size={13} className="animate-spin" />} {tr("Simpan perubahan")}
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-2xl bg-bg p-3.5">
                    <p className="text-2xs font-bold uppercase tracking-[0.12em] text-textMuted">{tr("Konteks")}</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-text">
                      {task.description || tr("Belum ada konteks tambahan.")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-bg p-3.5">
                    <p className="text-2xs font-bold uppercase tracking-[0.12em] text-textMuted">{tr("Status")}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(Object.keys(statusMeta) as Task["status"][]).map((status) => (
                        <button
                          key={status}
                          onClick={() => setStatus(task, status)}
                          className={clsx(
                            "rounded-lg border px-2.5 py-1.5 text-2xs font-semibold",
                            task.status === status
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border text-textMuted",
                          )}
                        >
                          {statusMeta[status].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-bg p-3.5">
                    <p className="text-2xs font-bold uppercase tracking-[0.12em] text-textMuted">{tr("Relasi")}</p>
                    <div className="mt-2 space-y-1 text-xs text-text">
                      {projectName(task.project_id) && (
                        <p className="flex items-center gap-1.5">
                          <FolderKanban size={12} className="text-accent" /> {projectName(task.project_id)}
                        </p>
                      )}
                      {areaName(task.area_id) && <p>{areaName(task.area_id)}</p>}
                      {!projectName(task.project_id) && !areaName(task.area_id) && (
                        <p className="text-textMuted">{tr("Belum terhubung")}</p>
                      )}
                    </div>
                  </div>
                </div>

                {task.subtasks.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-border p-3.5">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                      <span>{tr("Langkah kecil")}</span>
                      <span className="text-textMuted">
                        {completedSubtasks}/{task.subtasks.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {task.subtasks.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => toggleSub(sub)}
                          className="flex w-full min-w-0 items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-left text-xs"
                        >
                          <span
                            className={clsx(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                              sub.status === "done"
                                ? "border-success bg-success text-white"
                                : "border-border text-transparent",
                            )}
                          >
                            {sub.status === "done" && <Check size={11} />}
                          </span>
                          <span
                            className={clsx(
                              "min-w-0 break-words",
                              sub.status === "done" ? "text-textMuted line-through" : "text-text",
                            )}
                          >
                            {sub.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="task-action-row mt-3 flex min-w-0 flex-wrap gap-2">
                  <a
                    href={`/focus?task=${task.id}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/5 px-3 text-xs font-semibold text-accent transition hover:-translate-y-0.5"
                  >
                    <Timer size={13} /> {tr("Fokus")}
                  </a>
                  <a
                    href={`/calendar?task=${task.id}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted transition hover:-translate-y-0.5 hover:text-accent"
                  >
                    <CalendarClock size={13} /> {tr("Jadwalkan")}
                  </a>
                  <button
                    onClick={() => void assistTask(task)}
                    disabled={assistTaskId === task.id}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-accent/15 bg-accent/5 px-3 text-xs font-semibold text-accent transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    <Sparkles size={13} /> {assistTaskId === task.id ? tr("Menyusun…") : tr("Susun dengan Licia")}
                  </button>
                  <button
                    onClick={() => startEdit(task)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted transition hover:-translate-y-0.5 hover:text-text"
                  >
                    <Pencil size={13} /> {tr("Edit")}
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-danger/15 bg-danger/5 px-3 text-xs font-semibold text-danger transition hover:-translate-y-0.5"
                  >
                    <Trash2 size={13} /> {tr("Hapus")}
                  </button>
                </div>

                <div className="mt-3 flex min-w-0 gap-2 border-t border-border pt-3">
                  <input
                    value={newSub[task.id] ?? ""}
                    onChange={(event) => setNewSub((current) => ({ ...current, [task.id]: event.target.value }))}
                    onKeyDown={(event) => event.key === "Enter" && addSubtask(task.id)}
                    placeholder={tr("Tambahkan langkah kecil…")}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-xs text-text outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <button
                    onClick={() => addSubtask(task.id)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-textMuted hover:text-accent"
                  >
                    <Plus size={13} /> {tr("Tambah")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="task-page mx-auto min-w-0 max-w-7xl space-y-5 pb-8 animate-licia-page-in">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0"><p className="text-2xs font-semibold text-accent">{tr("Execution")}</p><h1 className="font-display text-2xl text-text">{tr("Tugas")}</h1><p className="text-2xs text-textMuted">{tr("{active} tugas aktif",{active:stats.active})}</p></div>
        <PrimaryButton onClick={()=>setComposerOpen(true)} className="min-h-11 shrink-0 px-3.5 text-xs"><Plus size={15}/>{tr("Tugas")}</PrimaryButton>
      </header>
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <Chip active>{tr("Aktif")} {stats.active}</Chip>
        <Chip tone={stats.overdue>0?"danger":"default"}>{tr("Terlambat")} {stats.overdue}</Chip>
        <Chip>{tr("Hari ini")} {stats.today}</Chip>
        <Chip>{tr("{minutes} mnt",{minutes:stats.effort})}</Chip>
      </div>
      {composerOpen && (
        <Card className="task-capture border-accent/15 bg-surface p-4 shadow-2xl sm:p-5 rounded-t-[1.5rem] lg:rounded-2xl lg:shadow-sm fixed inset-x-0 bottom-0 z-modal max-h-[88dvh] overflow-y-auto lg:static lg:inset-auto lg:z-auto lg:max-h-none">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-bold uppercase tracking-[0.13em] text-accent">{tr("Tambah cepat")}</p>
              <TextInput
                id="task-capture-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                onKeyDown={(event) => event.key === "Enter" && addTask()}
                placeholder={tr("Apa yang perlu kamu selesaikan?")}
                className="mt-2 h-12 rounded-2xl bg-bg text-[15px]"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
              <div className="flex gap-1.5 sm:col-span-2">
                <button type="button" onClick={()=>{setCustomDueDate(false);setForm({...form,due_date:dateStrInTimezone(new Date(),timezone)});}} className={clsx("min-h-11 flex-1 rounded-xl border px-3 text-2xs font-semibold",!customDueDate&&form.due_date?"border-accent bg-accent/10 text-accent":"border-border bg-bg text-textMuted")}>{tr("Hari ini")}</button>
                <button type="button" onClick={()=>{setCustomDueDate(false);setForm({...form,due_date:dateStrInTimezone(new Date(Date.now()+86400000),timezone)});}} className="min-h-11 flex-1 rounded-xl border border-border bg-bg px-3 text-2xs font-semibold text-textMuted">{tr("Besok")}</button>
                <button type="button" onClick={()=>setCustomDueDate(true)} className={clsx("min-h-11 flex-1 rounded-xl border px-3 text-2xs font-semibold",customDueDate?"border-accent bg-accent/10 text-accent":"border-border bg-bg text-textMuted")}>{tr("Pilih…")}</button>
              </div>
              {customDueDate ? <input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs text-text"/> : <input type="time" value={form.due_time} onChange={e=>setForm({...form,due_time:e.target.value})} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs text-text" aria-label={tr("Waktu tenggat (opsional)")}/>}
              <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Task["priority"]})} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs font-semibold text-text"><option value="low">{tr("Rendah")}</option><option value="medium">{tr("Sedang")}</option><option value="high">{tr("Tinggi")}</option></select>
              <select value={form.estimated_minutes} onChange={e=>setForm({...form,estimated_minutes:e.target.value})} className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs font-semibold text-text"><option value="">{tr("Durasi")}</option><option value="15">15 mnt</option><option value="30">30 mnt</option><option value="60">1 jam</option><option value="90">1,5 jam</option></select>
            </div>
            <PrimaryButton onClick={addTask} disabled={saving} className="h-12 shrink-0 rounded-2xl px-5">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{" "}
              {saving ? tr("Menyimpan…") : tr("Tambah tugas")}
            </PrimaryButton>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-2xs text-textMuted">
              {tr(
                "Enter langsung menyimpan. Detail seperti project, area, durasi, dan konteks bisa ditambahkan setelahnya.",
              )}
            </span>
            <button
              onClick={() => {
                setForm((current) => ({ ...current, title: "", description: "" }));
                setComposerOpen(true);
                window.setTimeout(() => document.getElementById("task-capture-title")?.focus(), 30);
              }}
              className="inline-flex items-center gap-1.5 text-2xs font-semibold text-accent hover:underline"
            >
              <ArrowRight size={12} /> {tr("Tambah langsung di sini")}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              onClick={() => setForm({ ...form, title: tr("Selesaikan tugas terpenting hari ini"), priority: "high" })}
              className="rounded-xl border border-border bg-bg p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/30"
            >
              <b className="text-xs text-text">{tr("Prioritas hari ini")}</b>
              <span className="mt-1 block text-2xs text-textMuted">
                {tr("Isi cepat untuk pekerjaan paling penting.")}
              </span>
            </button>
            <button
              onClick={() =>
                setForm({
                  ...form,
                  title: tr("Tindak lanjuti agenda berikutnya"),
                  description: tr("Tindak lanjut dari agenda kalender."),
                  priority: "medium",
                })
              }
              className="rounded-xl border border-border bg-bg p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/30"
            >
              <b className="text-xs text-text">{tr("Follow-up agenda")}</b>
              <span className="mt-1 block text-2xs text-textMuted">
                {tr("Cocok untuk hasil rapat, kelas, atau janji.")}
              </span>
            </button>
            <button
              onClick={() => void runPriorityPlan()}
              disabled={Boolean(quickAction)}
              className="rounded-xl border border-accent/15 bg-accent/5 p-3 text-left transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              <b className="text-xs text-accent">{tr("Susun dengan Licia")}</b>
              <span className="mt-1 block text-2xs text-textMuted">
                {tr("Langsung susun prioritas tanpa membuka Chat.")}
              </span>
            </button>
          </div>
        </Card>
      )}

      {priorityItems.length ? (
        <Card className="border-accent/15 bg-accent/5 p-4 animate-licia-slide-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[.15em] text-accent">
                {tr("Susunan prioritas siap")}
              </p>
              <h3 className="mt-1 font-display text-xl text-text">{tr("Licia sudah menyusun langkahnya.")}</h3>
              <p className="mt-1 text-xs leading-relaxed text-textMuted">
                {priorityPlan?.focus ||
                  tr("Mulai dari pekerjaan yang paling berdampak dan paling dekat dengan waktunya.")}
              </p>
            </div>
            <button
              onClick={() => setPriorityPlan(null)}
              className="touch-target rounded-lg text-textMuted hover:text-text"
              aria-label={tr("Tutup hasil prioritas")}
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {priorityItems.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-2xl border border-border bg-surface p-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-2xs font-bold text-accent">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text">{item.title}</p>
                    {item.reason && <p className="mt-0.5 text-2xs leading-relaxed text-textMuted">{item.reason}</p>}
                    {item.action && (
                      <p className="mt-1 text-2xs font-semibold text-accent">
                        {tr("Langkah: {action}", { action: item.action })}
                      </p>
                    )}
                  </div>
                  {item.estimated_minutes ? (
                    <span className="shrink-0 rounded-full bg-bg px-2 py-1 text-2xs text-textMuted">
                      {tr("{estimated_minutes} mnt", { estimated_minutes: item.estimated_minutes })}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                void scheduleOpenTasks(priorityItems.map((item) => item.id).filter((id): id is string => Boolean(id)))
              }
              disabled={Boolean(quickAction)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-accent px-3 text-2xs font-semibold text-white"
            >
              {tr("Jadwalkan prioritas")}
            </button>
            <Link
              href="/focus"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-bg px-3 text-2xs font-semibold text-textMuted hover:text-accent"
            >
              {tr("Mulai fokus")}
            </Link>
          </div>
        </Card>
      ) : (
        actionResult && (
          <Card
            className={clsx(
              "border-accent/15 bg-accent/5 p-4 animate-licia-slide-in",
              actionResult.tone === "warning" && "border-danger/15 bg-danger/5",
              actionResult.tone === "success" && "border-success/15 bg-success/5",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-accent/10 p-3 text-accent">
                <CheckCircle2 size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-bold uppercase tracking-[.15em] text-accent">{actionResult.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-textMuted">{actionResult.message}</p>
                {actionResult.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {actionResult.items.slice(0, 6).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-text"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setActionResult(null)}
                className="touch-target rounded-lg text-textMuted hover:text-text"
                aria-label={tr("Tutup hasil")}
              >
                <X size={14} />
              </button>
            </div>
          </Card>
        )
      )}
      <details className="rounded-2xl border border-border bg-surface"><summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-textMuted">{tr("Impor dari… dan aksi lanjutan")}</summary><section className="task-bridge-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: CalendarDays,
            label: tr("Agenda → Tugas"),
            text: tr("Jadikan agenda hari ini sebagai tugas yang langsung terhubung."),
            action: convertAgendaToTasks,
            busy: "agenda-task",
          },
          {
            icon: Inbox,
            label: tr("Inbox → Tugas"),
            text: tr("Ubah tangkapan Inbox terbuka menjadi tugas nyata."),
            action: convertInboxToTasks,
            busy: "inbox-task",
          },
          {
            icon: CalendarClock,
            label: tr("Tugas → Agenda"),
            text: tr("Cari celah waktu hari ini dan jadwalkan tugas terbuka."),
            action: scheduleOpenTasks,
            busy: "task-agenda",
          },
          {
            icon: AlarmClock,
            label: tr("Agenda → Pengingat"),
            text: tr("Buat pengingat untuk agenda hari ini tanpa membuka halaman lain."),
            action: createAgendaReminders,
            busy: "reminders",
          },
        ].map((item, index) => {
          const Icon = item.icon;
          const busy = quickAction === item.busy;
          return (
            <button
              key={item.label}
              onClick={() => void item.action()}
              disabled={Boolean(quickAction)}
              style={{ animationDelay: `${index * 60}ms` }}
              className="task-bridge-card group flex min-w-0 items-center gap-3 rounded-[1.35rem] border border-border bg-surface p-3.5 text-left animate-licia-card-in disabled:cursor-wait disabled:opacity-60"
            >
              <span className="shrink-0 rounded-2xl bg-accent/10 p-2.5 text-accent transition group-hover:scale-110">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block break-words text-xs text-text">{item.label}</b>
                <span className="mt-0.5 block break-words text-2xs leading-relaxed text-textMuted">{item.text}</span>
              </span>
              <ArrowRight
                size={13}
                className="shrink-0 text-textMuted transition group-hover:translate-x-1 group-hover:text-accent"
              />
            </button>
          );
        })}
      </section></details>
      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Layers3 size={15} className="text-accent" />
                  <h2 className="font-display text-lg text-text">{tr("Ruang kerja")}</h2>
                </div>
                <p className="mt-1 text-2xs text-textMuted">
                  {tr("{filtered_length} tugas terlihat · {done} sudah selesai", {
                    filtered_length: filtered.length,
                    done: stats.done,
                  })}
                </p>
              </div>
              <div
                className="flex shrink-0 gap-1 rounded-xl border border-border bg-bg p-1"
                role="group"
                aria-label={t("Tampilan tugas")}
              >
                {(
                  [
                    ["list", List, "Daftar"],
                    ["board", Columns3, "Papan Kanban"],
                    ["matrix", Grid2X2, "Matriks Eisenhower"],
                    ["week", CalendarRange, "Pekan"],
                  ] as const
                ).map(([mode, ViewIcon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLayout(mode)}
                    aria-pressed={layout === mode}
                    className={clsx(
                      "touch-target inline-flex items-center justify-center rounded-lg px-2",
                      layout === mode ? "bg-surface text-accent shadow-sm" : "text-textMuted",
                    )}
                    title={t(label)}
                    aria-label={t(label)}
                  >
                    <ViewIcon size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex min-w-0 flex-col gap-2 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textMuted"
                />
                <TextInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tr("Cari tugas…")}
                  className="pl-9"
                />
              </div>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-xs font-semibold text-text"
              >
                <option value="next">{tr("Urutkan: deadline")}</option>
                <option value="priority">{tr("Urutkan: prioritas")}</option>
                <option value="effort">{tr("Urutkan: durasi")}</option>
              </select>
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {filterItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={clsx(
                    "shrink-0 rounded-xl border px-3 py-2 text-2xs font-semibold transition",
                    filter === item.id
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-border bg-surface text-textMuted hover:border-accent/30 hover:text-accent",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-2xs text-textMuted">
                <input
                  type="checkbox"
                  checked={showDone}
                  onChange={(event) => setShowDone(event.target.checked)}
                  className="accent-[rgb(var(--accent-rgb))]"
                />{" "}
                {tr("Tampilkan selesai")}
              </label>
              <span className="text-2xs text-textMuted">{timezone.replace("Asia/", "")}</span>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-28 animate-licia-shimmer rounded-2xl bg-bg" />
                ))}
              </div>
            ) : !filtered.length ? (
              <EmptyState
                examples={[
                  "kirim laporan besok jam 9 pagi !1",
                  "telepon dokter Jumat sore",
                  "bayar listrik tanggal 20",
                ]}
                exampleMode="task"
                title={tr("Belum ada tugas di sini")}
                description={
                  filter === "all"
                    ? tr("Gunakan Tambah Cepat atau minta Licia menarik tugas dari agenda, Inbox, atau project.")
                    : tr("Coba ubah filter atau pencarian.")
                }
              />
            ) : layout === "board" ? (
              <TaskKanban tasks={filtered} timezone={timezone} onOpen={openFromView} onPatch={patchTask} />
            ) : layout === "matrix" ? (
              <TaskMatrix tasks={filtered} timezone={timezone} onOpen={openFromView} onPatch={patchTask} />
            ) : layout === "week" ? (
              <TaskWeek tasks={filtered} timezone={timezone} onOpen={openFromView} onPatch={patchTask} />
            ) : (
              <div className="space-y-2.5">
                {filtered.map((task, index) => (
                  <TaskCard key={task.id} task={task} index={index} />
                ))}
                <p className="px-1 pt-1 text-2xs text-textMuted">
                  {t("Pintasan: J/K pindah · X selesai · E ubah · Enter buka · # hapus")}
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-accent/15 bg-gradient-to-br from-accent/10 via-surface to-surface p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-accent/10 p-3 text-accent animate-licia-float">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-2xs font-bold uppercase tracking-[0.13em] text-accent">
                  {tr("Licia melihat konteks")}
                </p>
                <h3 className="mt-1 font-display text-xl text-text">
                  {tr("Tugas pendek yang bisa diselesaikan sekarang.")}
                </h3>
                <p className="mt-1 text-2xs leading-relaxed text-textMuted">
                  {tr(
                    "Ini bukan prioritas otomatis. Gunakan sebagai shortlist saat kamu punya energi rendah atau celah waktu kecil.",
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {shortTasks.length ? (
                shortTasks.map((task) => (
                  <a
                    key={task.id}
                    href={`/focus?task=${task.id}`}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface/85 p-3 transition hover:-translate-y-0.5 hover:border-accent/25"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg text-accent">
                      <Timer size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs font-semibold text-text">{task.title}</p>
                      <p className="mt-0.5 text-2xs text-textMuted">
                        {tr("{estimated_minutes} menit", { estimated_minutes: task.estimated_minutes })}
                      </p>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-textMuted" />
                  </a>
                ))
              ) : (
                <p className="rounded-2xl bg-bg p-3 text-2xs leading-relaxed text-textMuted">
                  {tr(
                    "Belum ada tugas pendek yang cocok. Tambahkan estimasi durasi agar Licia bisa membantu memilih langkah kecil.",
                  )}
                </p>
              )}
            </div>
          </Card>
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Target size={15} className="text-accent" />
              <h3 className="font-display text-lg text-text">{tr("Hubungkan dengan Life OS")}</h3>
            </div>
            <div className="mt-3 grid gap-2">
              {[
                { href: "/calendar", label: "Kalender", text: "Jadikan slot waktu menjadi tindakan nyata." },
                {
                  href: "/inbox",
                  label: "Smart Inbox",
                  text: tr("Pindahkan ide mentah menjadi tugas yang bisa dieksekusi."),
                },
                {
                  href: "/goals-projects",
                  label: "Target & Proyek",
                  text: tr("Tempelkan pekerjaan ke tujuan yang lebih besar."),
                },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-bg p-3 transition hover:-translate-y-0.5 hover:border-accent/25"
                >
                  <span className="min-w-0 flex-1">
                    <b className="block text-xs text-text">{item.label}</b>
                    <span className="mt-0.5 block break-words text-2xs leading-relaxed text-textMuted">
                      {item.text}
                    </span>
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-accent" />
                </a>
              ))}
            </div>
            <a
              href="/guide"
              className="mt-3 inline-flex items-center gap-1.5 text-2xs font-semibold text-accent hover:underline"
            >
              {tr("Pelajari semua alur di Panduan")} <ArrowRight size={12} />
            </a>
          </Card>
        </div>
      </section>
    </div>
  );
}
