import { dateStrInTimezone, localDateTimeToIso } from "@/lib/date";

/** Logika murni untuk tampilan Tugas lanjutan (A9): matriks Eisenhower dan minggu. Diuji di tests/taskViews.test.ts. */
export type ViewTask = { id: string; status: "todo" | "in_progress" | "done"; priority: "low" | "medium" | "high"; due_at: string | null };
export type Quadrant = "doFirst" | "schedule" | "quick" | "later";
export const QUADRANTS: readonly Quadrant[] = ["doFirst", "schedule", "quick", "later"] as const;
export const URGENT_WINDOW_MS = 48 * 3600 * 1000;

/** Penting = prioritas tinggi. Mendesak = jatuh tempo (atau terlambat) dalam 48 jam. */
export const isImportant = (task: Pick<ViewTask, "priority">) => task.priority === "high";
export function isUrgent(task: Pick<ViewTask, "due_at">, now: Date = new Date()) {
  if (!task.due_at) return false;
  const due = new Date(task.due_at).getTime();
  return Number.isFinite(due) && due - now.getTime() <= URGENT_WINDOW_MS;
}
export function quadrantOf(task: ViewTask, now: Date = new Date()): Quadrant {
  const important = isImportant(task), urgent = isUrgent(task, now);
  return important && urgent ? "doFirst" : important ? "schedule" : urgent ? "quick" : "later";
}

const shiftDay = (day: string, delta: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};
const timeOf = (iso: string | null, tz: string) => {
  if (!iso) return "09:00";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.hour === "24" ? "00" : map.hour}:${map.minute}`;
};

/** Perubahan minimal agar tugas pindah ke kuadran tujuan. Tidak menyentuh tugas yang sudah sesuai. */
export function quadrantPatch(task: ViewTask, target: Quadrant, tz: string, now: Date = new Date()): { priority?: ViewTask["priority"]; due_at?: string | null } {
  const patch: { priority?: ViewTask["priority"]; due_at?: string | null } = {};
  const wantImportant = target === "doFirst" || target === "schedule";
  const wantUrgent = target === "doFirst" || target === "quick";
  if (wantImportant && !isImportant(task)) patch.priority = "high";
  if (!wantImportant && isImportant(task)) patch.priority = "medium";
  const today = dateStrInTimezone(now, tz);
  if (wantUrgent && !isUrgent(task, now)) patch.due_at = localDateTimeToIso(today, task.due_at ? timeOf(task.due_at, tz) : "17:00", tz);
  if (!wantUrgent && isUrgent(task, now)) patch.due_at = localDateTimeToIso(shiftDay(today, 4), timeOf(task.due_at, tz), tz);
  return patch;
}

export type WeekDay = { day: string; isToday: boolean };
export function weekDays(now: Date, tz: string, count = 7): WeekDay[] {
  const today = dateStrInTimezone(now, tz);
  return Array.from({ length: count }, (_, i) => ({ day: shiftDay(today, i), isToday: i === 0 }));
}
export const dueDayOf = (task: Pick<ViewTask, "due_at">, tz: string) => (task.due_at ? dateStrInTimezone(new Date(task.due_at), tz) : null);
/** Memindahkan jatuh tempo ke hari lain dengan mempertahankan jam; `null` = tanpa tanggal. */
export function weekPatch(task: Pick<ViewTask, "due_at">, day: string | null, tz: string): { due_at: string | null } {
  if (day === null) return { due_at: null };
  return { due_at: localDateTimeToIso(day, timeOf(task.due_at, tz), tz) };
}
