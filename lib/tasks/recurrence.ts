/**
 * Tugas berulang (v0.57) — logika murni, tanpa akses jaringan/DOM, sehingga bisa diuji.
 *
 * Aturan disimpan di kolom JSON `tasks.recurrence`. Saat tugas berulang diselesaikan, aplikasi
 * membuat salinan berikutnya dengan tenggat dari `nextOccurrence()`.
 *
 * Desain:
 *  - Aritmetika kalender dilakukan pada "waktu dinding" zona waktu pengguna (offset tetap menit,
 *    default WIB = +420), sehingga jam tenggat tetap konsisten (Indonesia tidak mengenal DST).
 *  - Bulanan memakai `anchorDay` agar 31 Jan → 28 Feb → 31 Mar (tidak melorot ke tanggal 28).
 *  - Bila penyelesaian terlambat, kemunculan berikutnya dilompatkan ke masa depan (tidak membuat
 *    tumpukan tugas terlambat).
 */

export type RecurrenceFreq = "daily" | "weekdays" | "weekly" | "monthly";

export type RecurrenceRule = {
  freq: RecurrenceFreq;
  /** Selang antar kemunculan (≥1). Diabaikan untuk "weekdays". */
  interval: number;
  /** Untuk mingguan: hari dalam seminggu (0=Min … 6=Sab). Kosong → hari dari tenggat awal. */
  byWeekday?: number[];
  /** Untuk bulanan: tanggal jangkar (1–31). */
  anchorDay?: number;
  /** Batas akhir (YYYY-MM-DD, inklusif). */
  until?: string;
};

export const WIB_OFFSET_MINUTES = 420;
const DAY_MS = 86_400_000;

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Validasi + normalisasi aturan dari sumber tak tepercaya (JSON database / output AI). */
export function normalizeRule(input: unknown): RecurrenceRule | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const freq = raw.freq;
  if (freq !== "daily" && freq !== "weekdays" && freq !== "weekly" && freq !== "monthly") return null;
  const rule: RecurrenceRule = { freq, interval: freq === "weekdays" ? 1 : clampInt(raw.interval, 1, 365, 1) };
  if (freq === "weekly" && Array.isArray(raw.byWeekday)) {
    // Nilai di luar 0–6 dibuang (bukan dipaksa ke Sabtu/Minggu).
    const days = Array.from(new Set(raw.byWeekday.map((d) => (typeof d === "number" || typeof d === "string" ? Number(d) : NaN)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b);
    if (days.length) rule.byWeekday = days;
  }
  if (freq === "monthly" && raw.anchorDay != null) rule.anchorDay = clampInt(raw.anchorDay, 1, 31, 1);
  if (typeof raw.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.until)) rule.until = raw.until;
  return rule;
}

/** Hari-hari "dinding" sebagai {y,m,d,minutes} dalam bidang UTC dari timestamp yang digeser offset. */
function toWall(iso: string, offsetMin: number) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + offsetMin * 60_000);
}
const fromWall = (wall: Date, offsetMin: number) => new Date(wall.getTime() - offsetMin * 60_000);
const ymd = (wall: Date) => `${wall.getUTCFullYear()}-${String(wall.getUTCMonth() + 1).padStart(2, "0")}-${String(wall.getUTCDate()).padStart(2, "0")}`;
const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

function addDays(wall: Date, days: number) {
  return new Date(wall.getTime() + days * DAY_MS);
}

function addMonthsAnchored(wall: Date, months: number, anchorDay: number) {
  const total = wall.getUTCFullYear() * 12 + wall.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day, wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds()));
}

/** Satu langkah maju dari kemunculan `wall` menurut aturan (tanpa lompat ke masa depan). */
function stepOnce(rule: RecurrenceRule, wall: Date, anchorDay: number): Date {
  switch (rule.freq) {
    case "daily":
      return addDays(wall, rule.interval);
    case "weekdays": {
      let next = addDays(wall, 1);
      while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = addDays(next, 1);
      return next;
    }
    case "weekly": {
      const days = rule.byWeekday?.length ? rule.byWeekday : [wall.getUTCDay()];
      const current = wall.getUTCDay();
      // Masih ada hari lain dalam "minggu" yang sama setelah hari ini?
      const later = days.find((d) => d > current);
      if (later !== undefined) return addDays(wall, later - current);
      // Pindah ke minggu berikutnya (interval minggu), ambil hari pertama.
      const first = days[0];
      return addDays(wall, (first - current) + 7 * rule.interval);
    }
    case "monthly":
      return addMonthsAnchored(wall, rule.interval, anchorDay);
  }
}

export type NextOptions = {
  /** Kemunculan berikutnya harus lebih besar dari ini (default: tidak ada batas bawah selain tenggat). */
  after?: Date;
  tzOffsetMinutes?: number;
};

/**
 * Tenggat berikutnya (ISO UTC) setelah `fromIso`, atau null bila lewat `until` / masukan tak valid.
 */
export function nextOccurrence(ruleInput: unknown, fromIso: string, options: NextOptions = {}): string | null {
  const rule = normalizeRule(ruleInput);
  if (!rule) return null;
  const offset = options.tzOffsetMinutes ?? WIB_OFFSET_MINUTES;
  const start = toWall(fromIso, offset);
  if (!start) return null;
  const anchorDay = rule.anchorDay ?? start.getUTCDate();
  const afterMs = options.after?.getTime() ?? Number.NEGATIVE_INFINITY;

  let cursor = start;
  // Batas pengaman: 5 tahun harian ≈ 1.826 langkah; 4.000 cukup tanpa risiko loop tak hingga.
  for (let i = 0; i < 4000; i += 1) {
    cursor = stepOnce(rule, cursor, anchorDay);
    const candidate = fromWall(cursor, offset);
    if (rule.until && ymd(cursor) > rule.until) return null;
    if (candidate.getTime() > afterMs) return candidate.toISOString();
  }
  return null;
}

/** Salinan tugas berikutnya bila `task` berulang & selesai; null bila tidak perlu. */
export function buildNextTask<T extends { due_at?: string | null; recurrence?: unknown }>(task: T, now: Date = new Date(), tzOffsetMinutes = WIB_OFFSET_MINUTES): { due_at: string } | null {
  const rule = normalizeRule(task.recurrence);
  if (!rule) return null;
  const base = task.due_at || now.toISOString();
  const next = nextOccurrence(rule, base, { after: now, tzOffsetMinutes });
  return next ? { due_at: next } : null;
}

/* ------------------------------------------------------------------ */
/* Pengenalan dari teks bebas (ID + EN)                                 */
/* ------------------------------------------------------------------ */

const DAY_WORDS: Array<{ re: string; day: number }> = [
  { re: "minggu|ahad|sunday|sun", day: 0 },
  { re: "senin|monday|mon", day: 1 },
  { re: "selasa|tuesday|tue|tues", day: 2 },
  { re: "rabu|wednesday|wed", day: 3 },
  { re: "kamis|thursday|thu|thur|thurs", day: 4 },
  { re: "jum'?at|jumat|friday|fri", day: 5 },
  { re: "sabtu|saturday|sat", day: 6 },
];

export type ParsedRecurrence = { rule: RecurrenceRule; /** Teks asli tanpa frasa pengulangan. */ cleaned: string; matched: string };

function stripPhrase(text: string, matched: string) {
  return text.replace(matched, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Mengenali frasa seperti "setiap hari", "tiap senin", "every 2 weeks", "tiap bulan", "hari kerja".
 * Konservatif: "minggu" polos tidak dianggap hari Minggu kecuali didahului "setiap/tiap/every".
 */
export function parseRecurrence(text: string): ParsedRecurrence | null {
  const input = String(text ?? "");
  const lower = input.toLowerCase();
  const find = (re: RegExp) => {
    const m = re.exec(lower);
    return m ? { m, matched: input.slice(m.index, m.index + m[0].length) } : null;
  };

  let hit = find(/\b(?:setiap|tiap|every)\s+(?:hari\s*kerja|weekdays?|workdays?)\b|\bhari\s+kerja\b|\bweekdays\b/);
  if (hit) return { rule: { freq: "weekdays", interval: 1 }, cleaned: stripPhrase(input, hit.matched), matched: hit.matched };

  hit = find(/\b(?:setiap|tiap|every)\s+(\d{1,3})\s*(hari|days?|minggu|pekan|weeks?|bulan|months?)\b/);
  if (hit) {
    const n = clampInt(hit.m[1], 1, 365, 1);
    const unit = hit.m[2];
    const freq: RecurrenceFreq = /hari|day/.test(unit) ? "daily" : /minggu|pekan|week/.test(unit) ? "weekly" : "monthly";
    return { rule: { freq, interval: n }, cleaned: stripPhrase(input, hit.matched), matched: hit.matched };
  }

  hit = find(/\b(?:setiap|tiap|every)\s+(?:hari|day)\b|\bdaily\b|\bharian\b/);
  if (hit) return { rule: { freq: "daily", interval: 1 }, cleaned: stripPhrase(input, hit.matched), matched: hit.matched };

  hit = find(/\b(?:setiap|tiap|every)\s+(?:bulan|month)\b|\bmonthly\b|\bbulanan\b/);
  if (hit) return { rule: { freq: "monthly", interval: 1 }, cleaned: stripPhrase(input, hit.matched), matched: hit.matched };

  // Nama hari: "setiap senin", "tiap jumat", "every friday" (boleh beberapa: "setiap senin dan kamis").
  const dayAlt = DAY_WORDS.map((d) => d.re).join("|");
  hit = find(new RegExp(`\\b(?:setiap|tiap|every)\\s+((?:${dayAlt})(?:\\s*(?:,|dan|and|&)\\s*(?:${dayAlt}))*)\\b`));
  if (hit) {
    const list = hit.m[1];
    const days: number[] = [];
    for (const { re, day } of DAY_WORDS) if (new RegExp(`\\b(?:${re})\\b`).test(list)) days.push(day);
    if (days.length) return { rule: { freq: "weekly", interval: 1, byWeekday: days.sort((a, b) => a - b) }, cleaned: stripPhrase(input, hit.matched), matched: hit.matched };
  }

  hit = find(/\b(?:setiap|tiap|every)\s+(?:minggu|pekan|week)\b|\bweekly\b|\bmingguan\b/);
  if (hit) return { rule: { freq: "weekly", interval: 1 }, cleaned: stripPhrase(input, hit.matched), matched: hit.matched };

  return null;
}

/* ------------------------------------------------------------------ */
/* Deskripsi manusiawi (dwibahasa)                                      */
/* ------------------------------------------------------------------ */

const DAY_LABEL = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
} as const;

export function describeRule(ruleInput: unknown, language: "id" | "en" = "id"): string {
  const rule = normalizeRule(ruleInput);
  if (!rule) return language === "en" ? "Does not repeat" : "Tidak berulang";
  const id = language === "id";
  const days = (rule.byWeekday ?? []).map((d) => DAY_LABEL[language][d]);
  switch (rule.freq) {
    case "daily":
      return rule.interval === 1 ? (id ? "Setiap hari" : "Every day") : id ? `Setiap ${rule.interval} hari` : `Every ${rule.interval} days`;
    case "weekdays":
      return id ? "Hari kerja" : "Weekdays";
    case "weekly": {
      const base = rule.interval === 1 ? (id ? "Setiap minggu" : "Every week") : id ? `Setiap ${rule.interval} minggu` : `Every ${rule.interval} weeks`;
      return days.length ? `${base} (${days.join(", ")})` : base;
    }
    case "monthly":
      return rule.interval === 1 ? (id ? "Setiap bulan" : "Every month") : id ? `Setiap ${rule.interval} bulan` : `Every ${rule.interval} months`;
  }
}
