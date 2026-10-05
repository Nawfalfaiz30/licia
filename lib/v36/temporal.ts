export type ResolvedDate = {
  date: string;
  weekday: string;
  source: string;
  confidence: "high" | "medium";
  weekdayMatch?: boolean;
  kind?: "date" | "week";
  rangeStart?: string;
  rangeEnd?: string;
};

const WEEKDAYS = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"] as const;
const WEEKDAY_ALIASES: Record<string, number> = {
  senin: 1, monday: 1,
  selasa: 2, tuesday: 2,
  rabu: 3, wednesday: 3,
  kamis: 4, thursday: 4,
  jumat: 5, "jum'at": 5, friday: 5,
  sabtu: 6, saturday: 6,
  minggu: 7, ahad: 7, sunday: 7,
};

function partsInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function dateAtNoon(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function ymd(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isoDay(d: Date) {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

function parseExplicit(input: string, reference: Date): { date: Date; source: string } | null {
  const iso = input.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return { date: dateAtNoon(Number(iso[1]), Number(iso[2]), Number(iso[3])), source: "tanggal ISO eksplisit" };
  const slash = input.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);
  if (slash) return { date: dateAtNoon(Number(slash[3]), Number(slash[2]), Number(slash[1])), source: "tanggal eksplisit" };
  const monthDay = input.match(/\btanggal\s+(\d{1,2})\b/i);
  if (monthDay) {
    const p = partsInTimezone(reference, "UTC");
    let candidate = dateAtNoon(p.year, p.month, Number(monthDay[1]));
    if (candidate.getUTCDate() !== Number(monthDay[1])) return null;
    if (candidate.getTime() < dateAtNoon(p.year, p.month, p.day).getTime() && /bulan\s+depan|bulan\s+berikut/i.test(input)) candidate = dateAtNoon(p.year, p.month + 1, Number(monthDay[1]));
    return { date: candidate, source: "nomor tanggal" };
  }
  return null;
}

function weekdayName(iso: number) { return WEEKDAYS[Math.max(1, Math.min(7, iso)) - 1]; }

export function resolveNaturalDate(input: string, referenceDate: Date, timezone = "Asia/Jakarta"): ResolvedDate[] {
  const text = String(input || "").trim().toLocaleLowerCase("id-ID");
  if (!text) return [];
  const p = partsInTimezone(referenceDate, timezone);
  const ref = dateAtNoon(p.year, p.month, p.day);
  const explicit = parseExplicit(text, ref);

  const nonSundayWeekday = Object.keys(WEEKDAY_ALIASES).filter((key) => key !== "minggu").find((key) => new RegExp(`\\b${key.replace("'", "['’]?\\s?")}\\b`, "i").test(text));
  const weekOnly = /\bminggu\s+(ini|depan|berikutnya|lalu|kemarin)\b|\b(this|next|last)\s+week\b/i.test(text) && !nonSundayWeekday;
  const weekdayToken = nonSundayWeekday || (/(?:^|\s)minggu(?:$|\s)/i.test(text) && !weekOnly ? "minggu" : undefined);
  const weekday = weekdayToken ? WEEKDAY_ALIASES[weekdayToken] : null;
  const relative = text.includes("lusa") ? 2 : text.includes("besok") ? 1 : /\bkemarin\b/.test(text) ? -1 : text.includes("hari ini") || text === "today" ? 0 : null;

  if (explicit) {
    let expected = explicit.date;
    let actualWeekday = isoDay(expected);
    let weekdayMatch = weekday ? actualWeekday === weekday : undefined;
    let source = explicit.source;

    // "tanggal 26, Sabtu" adalah constraint ganda. Jika tanggal pada bulan
    // referensi tidak cocok, jangan serahkan keputusan kalender ke LLM. Cari
    // tanggal 26 berikutnya yang benar-benar jatuh pada Sabtu/Minggu/etc.
    const monthDayOnly = /\btanggal\s+(\d{1,2})\b/i.exec(text);
    if (monthDayOnly && weekday) {
      const wantedDay = Number(monthDayOnly[1]);
      const baseParts = partsInTimezone(referenceDate, timezone);
      const candidateMismatch = weekdayMatch === false;
      if (candidateMismatch) {
        for (let offset = 0; offset <= 12; offset += 1) {
          const monthIndex = baseParts.month - 1 + offset;
          const year = baseParts.year + Math.floor(monthIndex / 12);
          const month = (monthIndex % 12) + 1;
          const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
          if (wantedDay > maxDay) continue;
          const candidate = dateAtNoon(year, month, wantedDay);
          if (isoDay(candidate) !== weekday) continue;
          if (candidate.getTime() < ref.getTime()) continue;
          expected = candidate;
          actualWeekday = isoDay(candidate);
          weekdayMatch = true;
          source = `${explicit.source} + hari divalidasi`;
          break;
        }
      }
      if (weekdayMatch === true && expected.getTime() < ref.getTime()) {
        source = `${source}; tanggal eksplisit sudah lewat`;
      }
    }

    return [{ date: ymd(expected), weekday: weekdayName(actualWeekday), source: weekdayMatch === false ? `${source}; hari tidak cocok` : source, confidence: weekdayMatch === false ? "medium" : "high", ...(weekdayMatch === undefined ? {} : { weekdayMatch }) }];
  }

  if (weekOnly) {
    const currentIsoDay = isoDay(ref);
    const thisMonday = addDays(ref, 1 - currentIsoDay);
    const isNext = /\bminggu\s+(depan|berikutnya)\b|\bnext\s+week\b/i.test(text);
    const isPrevious = /\bminggu\s+(lalu|kemarin)\b|\blast\s+week\b/i.test(text);
    const start = addDays(thisMonday, isNext ? 7 : isPrevious ? -7 : 0);
    const end = addDays(start, 6);
    return [{ date: ymd(start), weekday: weekdayName(isoDay(start)), source: isNext ? "rentang minggu berikutnya" : isPrevious ? "rentang minggu sebelumnya" : "rentang minggu berjalan", confidence: "high", kind: "week", rangeStart: ymd(start), rangeEnd: ymd(end) }];
  }

  if (relative !== null) {
    const d = addDays(ref, relative);
    return [{ date: ymd(d), weekday: weekdayName(isoDay(d)), source: relative === 0 ? "hari ini" : relative > 0 ? "tanggal relatif" : "tanggal relatif lampau", confidence: "high" }];
  }

  if (weekday) {
    const currentDay = isoDay(ref);
    let delta = (weekday - currentDay + 7) % 7;
    const nextWeek = /minggu\s+depan|week\s+depan|next\s+week/i.test(text);
    const thisWeek = /minggu\s+ini|this\s+week/i.test(text);
    const explicitNext = /depan|berikutnya|next/i.test(text);
    if (nextWeek) delta = delta === 0 ? 7 : delta + 7;
    else if (thisWeek) delta = delta;
    else if (explicitNext) delta = delta === 0 ? 7 : delta + 7;
    const d = addDays(ref, delta);
    return [{ date: ymd(d), weekday: weekdayName(weekday), source: nextWeek || explicitNext ? "hari dalam minggu berikutnya" : thisWeek ? "hari dalam minggu berjalan" : "hari terdekat yang cocok", confidence: "high" }];
  }

  const pMonth = partsInTimezone(referenceDate, timezone);
  const monthDate = dateAtNoon(pMonth.year, pMonth.month, pMonth.day);
  return [{ date: ymd(monthDate), weekday: weekdayName(isoDay(monthDate)), source: "tanggal referensi timezone", confidence: "medium" }];
}

export function validateWeekdayDate(date: string, expectedWeekday: string, timezone = "Asia/Jakarta") {
  const clean = String(expectedWeekday || "").toLocaleLowerCase("id-ID").trim();
  const day = WEEKDAY_ALIASES[clean];
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { valid: false, actualWeekday: null, expectedWeekday: clean || null };
  const [y, m, d] = date.split("-").map(Number);
  const candidate = dateAtNoon(y, m, d);
  const actual = weekdayName(isoDay(candidate));
  return { valid: isoDay(candidate) === day, actualWeekday: actual, expectedWeekday: clean, date, timezone };
}

export function buildTemporalContext(referenceDate: Date, timezone: string) {
  const p = partsInTimezone(referenceDate, timezone);
  const local = dateAtNoon(p.year, p.month, p.day);
  return {
    timezone,
    today: ymd(local),
    weekday: weekdayName(isoDay(local)),
    nowIso: referenceDate.toISOString(),
    rule: "Semua label tanggal harus dihitung dalam timezone pengguna; tanggal eksplisit mengalahkan label hari dan harus divalidasi silang.",
  };
}
