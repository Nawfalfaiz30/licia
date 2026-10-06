"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, GripVertical } from "lucide-react";
import { clsx } from "clsx";
import { useLanguage } from "@/components/LanguageProvider";
import {
  QUADRANT_ORDER, STATUS_ORDER, bucketWeek, clearDuePatch, dayPatch, isEmptyPatch, quadrantOf, quadrantPatch, statusPatch, weekDays, weekStartYmd,
  type Quadrant, type TaskPatch, type TaskStatus, type ViewTask, type WeekStart,
} from "@/lib/tasks/views";
import { addDaysYmd } from "@/lib/text/smartParse";
import { dateStrInTimezone } from "@/lib/date";

type Common = {
  tasks: ViewTask[];
  timezone: string;
  onOpen: (task: ViewTask) => void;
  /** `summary` sudah diterjemahkan, mis. "Dipindah ke Hari ini". */
  onPatch: (task: ViewTask, patch: TaskPatch, summary: string) => void;
};

const DRAG_MIME = "application/x-licia-task";

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "Berikutnya", in_progress: "Dikerjakan", done: "Selesai" };
const STATUS_ICON: Record<TaskStatus, typeof Circle> = { todo: Circle, in_progress: Clock3, done: CheckCircle2 };
const STATUS_TONE: Record<TaskStatus, string> = { todo: "text-textMuted", in_progress: "text-accent", done: "text-success" };
const PRIORITY_DOT = { low: "bg-textMuted", medium: "bg-accent", high: "bg-danger" } as const;
const PRIORITY_LABEL = { low: "Prioritas rendah", medium: "Prioritas sedang", high: "Prioritas tinggi" } as const;

const QUADRANT_META: Record<Quadrant, { title: string; hint: string; tone: string }> = {
  do: { title: "Kerjakan sekarang", hint: "Penting & mendesak", tone: "border-danger/30 bg-danger/5" },
  plan: { title: "Jadwalkan", hint: "Penting, belum mendesak", tone: "border-accent/30 bg-accent/5" },
  quick: { title: "Selesaikan cepat", hint: "Mendesak, kurang penting", tone: "border-border bg-bg/60" },
  later: { title: "Nanti / lepaskan", hint: "Tidak penting & tidak mendesak", tone: "border-border bg-bg/40" },
};

function useDragState() {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  return { dragId, setDragId, overKey, setOverKey };
}

type MoveOption = { value: string; label: string };

function MiniCard({ task, timezone, onOpen, options, onMove, onDragStart, onDragEnd, dragging }: {
  task: ViewTask; timezone: string; onOpen: (t: ViewTask) => void; options: MoveOption[]; onMove: (value: string) => void;
  onDragStart: (id: string) => void; onDragEnd: () => void; dragging: boolean;
}) {
  const { t, locale } = useLanguage();
  const Icon = STATUS_ICON[task.status];
  const due = task.due_at ? new Intl.DateTimeFormat(locale, { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(task.due_at)) : null;
  const overdue = Boolean(task.due_at && task.status !== "done" && new Date(task.due_at).getTime() < Date.now());
  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, task.id); e.dataTransfer.setData("text/plain", task.title); e.dataTransfer.effectAllowed = "move"; onDragStart(task.id); }}
      onDragEnd={onDragEnd}
      className={clsx("group cursor-grab rounded-xl border bg-surface p-2.5 shadow-sm transition active:cursor-grabbing", dragging && "opacity-40", overdue ? "border-danger/30" : "border-border")}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={13} className="mt-0.5 shrink-0 text-textMuted/60" aria-hidden="true" />
        <Icon size={14} className={clsx("mt-0.5 shrink-0", STATUS_TONE[task.status])} aria-hidden="true" />
        <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
          <span className={clsx("block break-words text-xs font-semibold leading-snug text-text", task.status === "done" && "text-textMuted line-through")}>{task.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-textMuted">
            <span className="inline-flex items-center gap-1"><span className={clsx("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} aria-hidden="true" /><span className="sr-only">{t(PRIORITY_LABEL[task.priority])}</span></span>
            {due && <span className={overdue ? "font-semibold text-danger" : ""}>{due}</span>}
            {task.estimated_minutes ? <span>{t("{n} mnt", { n: task.estimated_minutes })}</span> : null}
          </span>
        </button>
      </div>
      {/* Alternatif non-seret (WCAG 2.5.7): layar sentuh dan pengguna keyboard memindahkan lewat pilihan ini. */}
      <label className="mt-2 block">
        <span className="sr-only">{t("Pindahkan {title}", { title: task.title })}</span>
        <select value="" onChange={(e) => { if (e.target.value) onMove(e.target.value); }} className="min-h-9 w-full rounded-lg border border-border bg-bg px-2 text-2xs font-semibold text-textMuted">
          <option value="">{t("Pindahkan ke…")}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </article>
  );
}

function DropColumn({ id, over, onOver, onDropId, children, className, label }: { id: string; over: string | null; onOver: (key: string | null) => void; onDropId: (taskId: string) => void; children: React.ReactNode; className?: string; label: string }) {
  return (
    <section
      aria-label={label}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onOver(id); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onOver(null); }}
      onDrop={(e) => { e.preventDefault(); const taskId = e.dataTransfer.getData(DRAG_MIME); onOver(null); if (taskId) onDropId(taskId); }}
      className={clsx("min-w-0 rounded-2xl border p-2.5 transition", over === id ? "border-accent bg-accent/10 ring-2 ring-accent/30" : "", className)}
    >
      {children}
    </section>
  );
}

/* ------------------------------- Kanban ------------------------------- */

export function TaskKanban({ tasks, timezone, onOpen, onPatch }: Common) {
  const { t } = useLanguage();
  const drag = useDragState();
  const byId = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const move = (task: ViewTask, status: TaskStatus) => {
    const patch = statusPatch(task, status);
    if (patch) onPatch(task, patch, t("Dipindah ke {to}", { to: t(STATUS_LABEL[status]) }));
  };
  const options = STATUS_ORDER.map((s) => ({ value: s, label: t(STATUS_LABEL[s]) }));
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {STATUS_ORDER.map((status) => {
        const items = tasks.filter((x) => x.status === status);
        const Icon = STATUS_ICON[status];
        return (
          <DropColumn key={status} id={status} over={drag.overKey} onOver={drag.setOverKey} onDropId={(id) => { const task = byId.get(id); if (task) move(task, status); drag.setDragId(null); }} label={t(STATUS_LABEL[status])} className="border-border bg-bg/45">
            <div className="flex items-center justify-between px-1.5 py-1.5">
              <div className="flex items-center gap-2"><Icon size={13} className={STATUS_TONE[status]} aria-hidden="true" /><h3 className="text-2xs font-bold uppercase tracking-[0.12em] text-textMuted">{t(STATUS_LABEL[status])}</h3></div>
              <span className="rounded-full bg-surface px-2 py-0.5 text-2xs font-bold text-textMuted">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((task) => <MiniCard key={task.id} task={task} timezone={timezone} onOpen={onOpen} options={options} onMove={(v) => move(task, v as TaskStatus)} onDragStart={drag.setDragId} onDragEnd={() => { drag.setDragId(null); drag.setOverKey(null); }} dragging={drag.dragId === task.id} />)}
              {!items.length && <p className="rounded-xl border border-dashed border-border p-4 text-center text-2xs text-textMuted">{t("Seret tugas ke sini")}</p>}
            </div>
          </DropColumn>
        );
      })}
    </div>
  );
}

/* ------------------------- Matriks Eisenhower ------------------------- */

export function TaskMatrix({ tasks, timezone, onOpen, onPatch }: Common) {
  const { t } = useLanguage();
  const drag = useDragState();
  const now = new Date();
  const open = tasks.filter((x) => x.status !== "done");
  const byId = useMemo(() => new Map(open.map((x) => [x.id, x])), [open]);
  const move = (task: ViewTask, target: Quadrant) => {
    const patch = quadrantPatch(task, target, timezone);
    if (!isEmptyPatch(patch)) onPatch(task, patch, t("Dipindah ke {to}", { to: t(QUADRANT_META[target].title) }));
  };
  const options = QUADRANT_ORDER.map((q) => ({ value: q, label: t(QUADRANT_META[q].title) }));
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {QUADRANT_ORDER.map((q) => {
          const items = open.filter((x) => quadrantOf(x, now) === q);
          const meta = QUADRANT_META[q];
          return (
            <DropColumn key={q} id={q} over={drag.overKey} onOver={drag.setOverKey} onDropId={(id) => { const task = byId.get(id); if (task) move(task, q); drag.setDragId(null); }} label={t(meta.title)} className={meta.tone}>
              <div className="flex items-start justify-between gap-2 px-1.5 py-1.5">
                <div><h3 className="text-xs font-bold text-text">{t(meta.title)}</h3><p className="text-2xs text-textMuted">{t(meta.hint)}</p></div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-2xs font-bold text-textMuted">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((task) => <MiniCard key={task.id} task={task} timezone={timezone} onOpen={onOpen} options={options} onMove={(v) => move(task, v as Quadrant)} onDragStart={drag.setDragId} onDragEnd={() => { drag.setDragId(null); drag.setOverKey(null); }} dragging={drag.dragId === task.id} />)}
                {!items.length && <p className="rounded-xl border border-dashed border-border/70 p-4 text-center text-2xs text-textMuted">{t("Kosong")}</p>}
              </div>
            </DropColumn>
          );
        })}
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-textMuted">{t("Penting = prioritas tinggi. Mendesak = tenggat dalam 48 jam atau sudah lewat. Memindahkan tugas mengubah prioritas dan/atau tenggatnya — bisa diurungkan.")}</p>
    </div>
  );
}

/* ------------------------------- Minggu ------------------------------- */

export function TaskWeek({ tasks, timezone, onOpen, onPatch, weekStartsOn = "monday" }: Common & { weekStartsOn?: WeekStart }) {
  const { t, locale } = useLanguage();
  const drag = useDragState();
  const today = dateStrInTimezone(new Date(), timezone);
  const [offset, setOffset] = useState(0);
  const start = addDaysYmd(weekStartYmd(today, weekStartsOn), offset * 7);
  const buckets = useMemo(() => bucketWeek(tasks, start, timezone), [tasks, start, timezone]);
  const byId = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const dayLabel = (ymd: string) => dayFmt.format(new Date(`${ymd}T00:00:00Z`));
  const days = weekDays(start);
  const options: MoveOption[] = [...days.map((ymd) => ({ value: ymd, label: dayLabel(ymd) })), { value: "none", label: t("Tanpa tanggal") }];

  const move = (task: ViewTask, target: string) => {
    const patch = target === "none" ? clearDuePatch() : dayPatch(task, target, timezone);
    if (target !== "none" && patch.due_at === task.due_at) return;
    if (target === "none" && !task.due_at) return;
    onPatch(task, patch, target === "none" ? t("Tenggat dihapus") : t("Dipindah ke {to}", { to: dayLabel(target) }));
  };
  const rangeLabel = `${dayLabel(days[0])} – ${dayLabel(days[6])}`;
  const card = (task: ViewTask) => <MiniCard key={task.id} task={task} timezone={timezone} onOpen={onOpen} options={options} onMove={(v) => move(task, v)} onDragStart={drag.setDragId} onDragEnd={() => { drag.setDragId(null); drag.setOverKey(null); }} dragging={drag.dragId === task.id} />;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text" aria-live="polite">{rangeLabel}</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setOffset((v) => v - 1)} aria-label={t("Pekan sebelumnya")} className="touch-target rounded-xl border border-border bg-surface text-textMuted hover:text-text"><ChevronLeft size={16} aria-hidden="true" /></button>
          <button type="button" onClick={() => setOffset(0)} disabled={offset === 0} className="min-h-11 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted hover:text-text disabled:opacity-50">{t("Pekan ini")}</button>
          <button type="button" onClick={() => setOffset((v) => v + 1)} aria-label={t("Pekan berikutnya")} className="touch-target rounded-xl border border-border bg-surface text-textMuted hover:text-text"><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[56rem] grid-cols-8 gap-2">
          {buckets.days.map(({ ymd, tasks: dayTasks }) => (
            <DropColumn key={ymd} id={ymd} over={drag.overKey} onOver={drag.setOverKey} onDropId={(id) => { const task = byId.get(id); if (task) move(task, ymd); drag.setDragId(null); }} label={dayLabel(ymd)} className={clsx("bg-bg/45", ymd === today ? "border-accent/40" : "border-border")}>
              <div className="flex items-center justify-between px-1 pb-1.5"><h3 className={clsx("text-2xs font-bold", ymd === today ? "text-accent" : "text-textMuted")}>{dayLabel(ymd)}</h3>{ymd === today && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-2xs font-bold text-accent">{t("Hari ini")}</span>}</div>
              <div className="space-y-2">{dayTasks.map(card)}{!dayTasks.length && <p className="py-3 text-center text-2xs text-textMuted/70">—</p>}</div>
            </DropColumn>
          ))}
          <DropColumn id="none" over={drag.overKey} onOver={drag.setOverKey} onDropId={(id) => { const task = byId.get(id); if (task) move(task, "none"); drag.setDragId(null); }} label={t("Tanpa tanggal")} className="border-dashed border-border bg-surface">
            <div className="flex items-center justify-between px-1 pb-1.5"><h3 className="text-2xs font-bold text-textMuted">{t("Tanpa tanggal")}</h3><span className="rounded-full bg-bg px-1.5 py-0.5 text-2xs font-bold text-textMuted">{buckets.unscheduled.length}</span></div>
            <div className="space-y-2">{buckets.unscheduled.slice(0, 20).map(card)}{!buckets.unscheduled.length && <p className="py-3 text-center text-2xs text-textMuted/70">—</p>}</div>
          </DropColumn>
        </div>
      </div>
      {buckets.outside.length > 0 && <p className="mt-2 text-2xs text-textMuted">{t("{n} tugas lain bertenggat di luar pekan ini.", { n: buckets.outside.length })}</p>}
    </div>
  );
}
