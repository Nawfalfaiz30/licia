"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { CalendarClock, Check, Clock3, GripVertical } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { QUADRANTS, dueDayOf, quadrantOf, quadrantPatch, weekDays, weekPatch, type Quadrant, type ViewTask } from "@/lib/tasks/views";
import { dateStrInTimezone } from "@/lib/date";

export type BoardTask = ViewTask & { title: string; estimated_minutes: number | null };
type Status = ViewTask["status"];
type Patch = { priority?: ViewTask["priority"]; due_at?: string | null; status?: Status };

type Props = {
  mode: "board" | "matrix" | "week";
  tasks: BoardTask[];
  timezone: string;
  onPatch: (task: BoardTask, patch: Patch, label: string) => void | Promise<void>;
  onToggleDone: (task: BoardTask) => void | Promise<void>;
  onOpen: (task: BoardTask) => void;
};

const STATUSES: Array<{ id: Status; label: string }> = [
  { id: "todo", label: "Berikutnya" },
  { id: "in_progress", label: "Dikerjakan" },
  { id: "done", label: "Selesai" },
];
const QUADRANT_META: Record<Quadrant, { title: string; hint: string; tone: string }> = {
  doFirst: { title: "Kerjakan dulu", hint: "Penting · mendesak", tone: "border-danger/25 bg-danger/5" },
  schedule: { title: "Jadwalkan", hint: "Penting · tidak mendesak", tone: "border-accent/25 bg-accent/5" },
  quick: { title: "Selesaikan cepat", hint: "Tidak penting · mendesak", tone: "border-border bg-bg/60" },
  later: { title: "Nanti / tinjau", hint: "Tidak penting · tidak mendesak", tone: "border-border bg-bg/40" },
};
const PRIORITY_TONE = { high: "bg-danger/10 text-danger", medium: "bg-accent/10 text-accent", low: "bg-bg text-textMuted" } as const;

function Column({ title, hint, count, tone, active, droppable = true, onDropTask, children, tr }: {
  title: string; hint?: string; count: number; tone?: string; active: boolean; droppable?: boolean;
  onDropTask: (taskId: string) => void; children: React.ReactNode; tr: (k: string) => string;
}) {
  const [over, setOver] = useState(false);
  return (
    <section
      aria-label={title}
      onDragOver={(e) => { if (droppable) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!droppable) return; e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDropTask(id); }}
      className={clsx("min-w-0 rounded-2xl border p-2.5 transition", tone ?? "border-border bg-bg/45", over && "ring-2 ring-accent/50", !active && "opacity-95")}
    >
      <header className="flex items-start justify-between gap-2 px-1.5 py-1.5">
        <div className="min-w-0"><p className="truncate text-[11px] font-bold uppercase tracking-[.1em] text-textMuted">{title}</p>{hint && <p className="text-[11px] text-textMuted">{tr(hint)}</p>}</div>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-textMuted">{count}</span>
      </header>
      <div className="space-y-2">{children}</div>
      {!count && <p className="px-2 py-4 text-center text-[11px] text-textMuted">{droppable ? tr("Seret tugas ke sini") : tr("Tidak ada")}</p>}
    </section>
  );
}

export function TaskViews({ mode, tasks, timezone, onPatch, onToggleDone, onOpen }: Props) {
  const { tr, locale } = useLanguage();
  const [dragId, setDragId] = useState<string | null>(null);
  const now = new Date();
  const today = dateStrInTimezone(now, timezone);
  const byId = (id: string) => tasks.find((t) => t.id === id);
  const open = tasks.filter((t) => t.status !== "done");

  const dueText = (task: BoardTask) => {
    if (!task.due_at) return tr("Tanpa tenggat");
    return new Intl.DateTimeFormat(locale, { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(task.due_at));
  };

  const renderCard = (task: BoardTask, moves: Array<{ value: string; label: string }>) => {
    const done = task.status === "done";
    return (
      <div
        key={task.id}
        data-list-item
        draggable
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; setDragId(task.id); }}
        onDragEnd={() => setDragId(null)}
        className={clsx("group rounded-xl border border-border bg-surface p-2.5 shadow-sm transition", dragId === task.id && "opacity-50", done && "opacity-70")}
      >
        <div className="flex items-start gap-2">
          <GripVertical size={14} className="mt-0.5 hidden shrink-0 cursor-grab text-textMuted sm:block" aria-hidden />
          <button type="button" data-list-action="toggle" onClick={() => void onToggleDone(task)} aria-label={done ? tr("Tandai belum selesai") : tr("Tandai selesai")} aria-pressed={done} className={clsx("touch-target mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", done ? "border-success bg-success text-white" : "border-border text-transparent hover:border-accent")}><Check size={12} /></button>
          <button type="button" data-list-action="edit" onClick={() => onOpen(task)} className={clsx("min-w-0 flex-1 break-words text-left text-xs font-semibold text-text hover:text-accent", done && "line-through")}>{task.title}</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={clsx("rounded-full px-2 py-0.5 font-semibold", PRIORITY_TONE[task.priority])}>{tr({ high: "Tinggi", medium: "Sedang", low: "Rendah" }[task.priority])}</span>
          <span className="inline-flex items-center gap-1 text-textMuted"><CalendarClock size={11} aria-hidden />{dueText(task)}</span>
          {task.estimated_minutes ? <span className="inline-flex items-center gap-1 text-textMuted"><Clock3 size={11} aria-hidden />{task.estimated_minutes} {tr("mnt")}</span> : null}
        </div>
        <label className="mt-2 block">
          <span className="sr-only">{tr("Pindahkan ke")}</span>
          <select value="" onChange={(e) => { const v = e.target.value; if (v) { e.target.value = ""; moveTask(task, v); } }} className="min-h-8 w-full rounded-lg border border-border bg-bg px-2 text-[11px] text-textMuted">
            <option value="">{tr("Pindahkan ke…")}</option>
            {moves.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
      </div>
    );
  };

  const fmtDay = (day: string) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`));

  function moveTask(task: BoardTask, target: string) {
    if (mode === "board") {
      if (task.status !== target) void onPatch(task, { status: target as Status }, tr(STATUSES.find((s) => s.id === target)?.label ?? target));
    } else if (mode === "matrix") {
      const patch = quadrantPatch(task, target as Quadrant, timezone, new Date());
      if (Object.keys(patch).length) void onPatch(task, patch, tr(QUADRANT_META[target as Quadrant].title));
    } else {
      const day = target === "none" ? null : target;
      if (dueDayOf(task, timezone) !== day) void onPatch(task, weekPatch(task, day, timezone), day ? fmtDay(day) : tr("Tanpa tanggal"));
    }
  }
  const drop = (target: string) => (id: string) => { const task = byId(id); if (task) moveTask(task, target); setDragId(null); };

  if (mode === "board") {
    return (
      <div className="grid gap-3 lg:grid-cols-3">
        {STATUSES.map((s) => {
          const items = tasks.filter((t) => t.status === s.id);
          return (
            <Column key={s.id} tr={tr} title={tr(s.label)} count={items.length} active={!!dragId} onDropTask={drop(s.id)}>
              {items.map((t) => renderCard(t, STATUSES.filter((x) => x.id !== t.status).map((x) => ({ value: x.id, label: tr(x.label) }))))}
            </Column>
          );
        })}
      </div>
    );
  }

  if (mode === "matrix") {
    return (
      <div>
        <p className="mb-2 text-[11px] leading-relaxed text-textMuted">{tr("Penting = prioritas tinggi. Mendesak = jatuh tempo dalam 48 jam. Memindahkan tugas mengubah prioritas/tenggatnya, dan bisa diurungkan.")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {QUADRANTS.map((q) => {
            const items = open.filter((t) => quadrantOf(t, now) === q);
            return (
              <Column key={q} tr={tr} title={tr(QUADRANT_META[q].title)} hint={QUADRANT_META[q].hint} tone={QUADRANT_META[q].tone} count={items.length} active={!!dragId} onDropTask={drop(q)}>
                {items.map((t) => renderCard(t, QUADRANTS.filter((x) => x !== q).map((x) => ({ value: x, label: tr(QUADRANT_META[x].title) }))))}
              </Column>
            );
          })}
        </div>
      </div>
    );
  }

  const days = weekDays(now, timezone);
  const overdue = open.filter((t) => { const d = dueDayOf(t, timezone); return d !== null && d < today; });
  const undated = open.filter((t) => !t.due_at);
  const dayMoves = [...days.map((d) => ({ value: d.day, label: fmtDay(d.day) })), { value: "none", label: tr("Tanpa tanggal") }];
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[62rem] grid-cols-8 gap-2.5 lg:min-w-0">
        <Column tr={tr} title={tr("Terlambat")} tone="border-danger/25 bg-danger/5" count={overdue.length} active={!!dragId} droppable={false} onDropTask={() => undefined}>
          {overdue.map((t) => renderCard(t, dayMoves))}
        </Column>
        {days.map(({ day, isToday }) => {
          const items = open.filter((t) => dueDayOf(t, timezone) === day);
          return (
            <Column key={day} tr={tr} title={isToday ? `${tr("Hari ini")} · ${fmtDay(day)}` : fmtDay(day)} tone={isToday ? "border-accent/30 bg-accent/5" : undefined} count={items.length} active={!!dragId} onDropTask={drop(day)}>
              {items.map((t) => renderCard(t, dayMoves.filter((m) => m.value !== day)))}
            </Column>
          );
        })}
      </div>
      <div className="mt-2.5">
        <Column tr={tr} title={tr("Tanpa tanggal")} count={undated.length} active={!!dragId} onDropTask={drop("none")}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{undated.map((t) => renderCard(t, dayMoves.filter((m) => m.value !== "none")))}</div>
        </Column>
      </div>
    </div>
  );
}
