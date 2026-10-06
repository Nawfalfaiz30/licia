/**
 * Logika murni tampilan Tugas v0.57: Kanban, Matriks Eisenhower, dan minggu.
 * Tidak menyentuh DOM/jaringan sehingga bisa diuji; komponen hanya menerjemahkan hasilnya ke mutasi.
 */
import { addDaysYmd } from "@/lib/text/smartParse";
import { dateStrInTimezone, localDateTimeToIso } from "@/lib/date";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type ViewTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  estimated_minutes?: number | null;
  version?: number | null;
  updated_at?: string | null;
};

export type TaskPatch = Partial<Pick<ViewTask, "status" | "priority" | "due_at">>;

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

/* ---------------------------- Eisenhower ---------------------------- */

export type Quadrant = "do" | "plan" | "quick" | "later";
export const QUADRANT_ORDER: Quadrant[] = ["do", "plan", "quick", "later"];
export const URGENT_WINDOW_HOURS = 48;
const HOUR = 3_600_000;

/** Mendesak = lewat tenggat atau jatuh tempo ≤ 48 jam. Penting = prioritas tinggi. */
export function isUrgent(task: Pick<ViewTask, "due_at" | "status">, now: Date = new Date()): boolean {
  if (task.status === "done" || !task.due_at) return false;
  const due = new Date(task.due_at).getTime();
  return Number.isFinite(due) && due - now.getTime() <= URGENT_WINDOW_HOURS * HOUR;
}
export const isImportant = (task: Pick<ViewTask, "priority">) => task.priority === "high";

export function quadrantOf(task: ViewTask, now: Date = new Date()): Quadrant {
  const urgent = isUrgent(task, now);
  const important = isImportant(task);
  if (urgent && important) return "do";
  if (important) return "plan";
  if (urgent) return "quick";
  return "later";
}

/**
 * Perubahan yang dibutuhkan agar tugas "mendarat" di kuadran target.
 *  - Sumbu penting → prioritas (high / medium).
 *  - Sumbu mendesak → tenggat: mendesak = hari ini 17:00 (bila belum dalam jendela 48 jam);
 *    tidak mendesak = 3 hari dari sekarang pada jam yang sama (bila saat ini mendesak). Tugas tanpa tenggat
 *    yang dipindah ke kuadran tidak-mendesak dibiarkan tanpa tenggat.
 * Selalu dapat diurungkan di UI (toast Urungkan).
 */
export function quadrantPatch(task: ViewTask, target: Quadrant, timezone: string, now: Date = new Date()): TaskPatch {
  const patch: TaskPatch = {};
  const wantImportant = target === "do" || target === "plan";
  const wantUrgent = target === "do" || target === "quick";

  if (wantImportant && task.priority !== "high") patch.priority = "high";
  if (!wantImportant && task.priority === "high") patch.priority = "medium";

  const urgentNow = isUrgent(task, now);
  const today = dateStrInTimezone(now, timezone);
  if (wantUrgent && !urgentNow) {
    patch.due_at = localDateTimeToIso(today, "17:00", timezone);
    if (patch.due_at && new Date(patch.due_at).getTime() < now.getTime()) patch.due_at = localDateTimeToIso(addDaysYmd(today, 1), "09:00", timezone);
  }
  if (!wantUrgent && urgentNow) {
    const time = task.due_at ? clockInTimezone(task.due_at, timezone) : "09:00";
    patch.due_at = localDateTimeToIso(addDaysYmd(today, 3), time, timezone);
  }
  if (task.status === "done") patch.status = "todo"; // memindah tugas selesai ke kuadran = membukanya lagi
  return patch;
}

/* ------------------------------ Minggu ------------------------------ */

export type WeekStart = "monday" | "sunday";

export function weekStartYmd(todayYmd: string, weekStartsOn: WeekStart = "monday"): string {
  const [y, m, d] = todayYmd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Minggu
  const back = weekStartsOn === "monday" ? (dow + 6) % 7 : dow;
  return addDaysYmd(todayYmd, -back);
}

export function weekDays(startYmd: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(startYmd, i));
}

export function clockInTimezone(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hh = get("hour") === "24" ? "00" : get("hour");
  return `${hh}:${get("minute")}`;
}

/** Memindahkan tugas ke hari tertentu; jam asli dipertahankan (bawaan 09:00 untuk tugas tanpa tenggat). */
export function dayPatch(task: Pick<ViewTask, "due_at">, ymd: string, timezone: string): TaskPatch {
  const time = task.due_at ? clockInTimezone(task.due_at, timezone) : "09:00";
  return { due_at: localDateTimeToIso(ymd, time, timezone) };
}

export function clearDuePatch(): TaskPatch { return { due_at: null }; }

export type WeekBuckets = { days: Array<{ ymd: string; tasks: ViewTask[] }>; unscheduled: ViewTask[]; outside: ViewTask[] };

/** Bagi tugas ke 7 hari; yang tanpa tenggat → `unscheduled`; tenggat di luar pekan ini → `outside`. */
export function bucketWeek(tasks: readonly ViewTask[], startYmd: string, timezone: string): WeekBuckets {
  const days = weekDays(startYmd).map((ymd) => ({ ymd, tasks: [] as ViewTask[] }));
  const index = new Map(days.map((d, i) => [d.ymd, i]));
  const unscheduled: ViewTask[] = [];
  const outside: ViewTask[] = [];
  for (const task of tasks) {
    if (!task.due_at) { if (task.status !== "done") unscheduled.push(task); continue; }
    const day = dateStrInTimezone(new Date(task.due_at), timezone);
    const i = index.get(day);
    if (i === undefined) outside.push(task);
    else days[i].tasks.push(task);
  }
  for (const d of days) d.tasks.sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
  return { days, unscheduled, outside };
}

/* ------------------------------ Kanban ------------------------------ */

export function statusPatch(task: ViewTask, status: TaskStatus): TaskPatch | null {
  return task.status === status ? null : { status };
}

/** Gabungkan patch dengan nilai sebelumnya — dipakai untuk membangun aksi "Urungkan". */
export function inversePatch(task: ViewTask, patch: TaskPatch): TaskPatch {
  const inverse: TaskPatch = {};
  for (const key of Object.keys(patch) as Array<keyof TaskPatch>) (inverse as Record<string, unknown>)[key] = task[key];
  return inverse;
}

export function isEmptyPatch(patch: TaskPatch | null | undefined): boolean {
  return !patch || Object.keys(patch).length === 0;
}

/* ------------------------- Pintasan daftar tugas ------------------------- */

export type TaskKeyAction = "next" | "prev" | "toggle" | "edit" | "open" | "first" | "last" | "delete" | null;

/** Pemetaan tombol → aksi untuk daftar tugas (j/k, x, e, Enter). Hanya tombol polos (tanpa Ctrl/⌘/Alt). */
export function taskKeyAction(key: string, mods: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {}): TaskKeyAction {
  if (mods.ctrl || mods.meta || mods.alt) return null;
  switch (key) {
    case "j": case "ArrowDown": return "next";
    case "k": case "ArrowUp": return "prev";
    case "x": return "toggle";
    case "e": return "edit";
    case "Enter": case "o": return "open";
    case "g": return null;
    case "Home": return "first";
    case "End": return "last";
    case "#": case "Delete": return "delete";
    default: return null;
  }
}

/** Indeks fokus berikutnya dalam daftar (tidak membungkus — berhenti di ujung). -1 = belum ada yang terfokus. */
export function stepFocus(current: number, action: "next" | "prev" | "first" | "last", length: number): number {
  if (length <= 0) return -1;
  if (action === "first") return 0;
  if (action === "last") return length - 1;
  if (current < 0) return action === "next" ? 0 : length - 1;
  return Math.max(0, Math.min(length - 1, current + (action === "next" ? 1 : -1)));
}
