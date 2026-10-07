/**
 * Smart capture parser (v0.56) — berjalan 100% di perangkat, tanpa jaringan dan tanpa AI.
 *
 * Mengubah teks bebas seperti
 *   "kirim laporan besok jam 7 malam !1 #kerja"
 * menjadi data terstruktur (tanggal, jam, prioritas, tag, nominal) + judul yang sudah bersih.
 * Dipakai untuk "smart chips" di Simpan Cepat, sehingga pengguna melihat apa yang akan
 * disimpan SEBELUM menekan tombol, dan tetap bekerja saat offline.
 *
 * Aturan desain:
 *  - Konservatif: bila ragu, jangan menebak. Lebih baik tidak ada chip daripada chip yang salah.
 *  - Deterministik: hasil hanya bergantung pada (teks, now, timezone).
 *  - Hanya fixed-offset timezone Indonesia (WIB/WITA/WIT), sama seperti lib/date.ts.
 */
import { dateStrInTimezone, localDateTimeToIso } from "@/lib/date";

export type SmartPriority = "high" | "medium" | "low";
export type SmartChipKind = "date" | "time" | "priority" | "tag" | "money";
export type SmartChip = { kind: SmartChipKind; label: string; raw: string };

export type SmartParseResult = {
  original: string;
  /** Teks dengan penanda tanggal/jam/prioritas (dan tag bila stripTags) sudah dibuang. */
  title: string;
  /** YYYY-MM-DD pada timezone yang diminta. */
  dueDate: string | null;
  /** HH:mm (24 jam). */
  dueTime: string | null;
  priority: SmartPriority | null;
  tags: string[];
  /** Nominal Rupiah pertama yang ditemukan (angka bulat/desimal), bila ada. */
  amount: number | null;
  chips: SmartChip[];
};

export type SmartParseOptions = {
  now?: Date;
  timezone?: string;
  /** Buang #tag dari judul. Set false bila tujuan penyimpanan tidak punya kolom tag (mis. tugas). */
  stripTags?: boolean;
  /** Bahasa label chip; bawaan "id". */
  lang?: ChipLang;
};

const DAY_NAMES_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;
const MONTH_NAMES_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;
const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Bahasa label chip (v0.57). Parser tetap mengenali ID + EN; ini hanya memengaruhi teks yang ditampilkan. */
export type ChipLang = "id" | "en";

// 0 = Minggu ... 6 = Sabtu. "minggu" polos sengaja TIDAK dikenali (ambigu dengan "minggu depan").
const WEEKDAYS: Array<{ re: string; day: number }> = [
  { re: "senin|monday|mon", day: 1 },
  { re: "selasa|tuesday|tue|tues", day: 2 },
  { re: "rabu|wednesday|wed", day: 3 },
  { re: "kamis|thursday|thu|thur|thurs", day: 4 },
  { re: "jum'?at|jumat|friday|fri", day: 5 },
  { re: "sabtu|saturday|sat", day: 6 },
  { re: "hari\\s+minggu|sunday|sun", day: 0 },
];

/* ------------------------------------------------------------------ */
/* Uang                                                                */
/* ------------------------------------------------------------------ */

/**
 * "47k" → 47000, "25rb" → 25000, "1,5jt" → 1500000, "Rp 12.500" → 12500,
 * "12500" → 12500. Mengembalikan null bila tidak bisa dibaca.
 */
export function parseMoneyId(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/rp\.?\s*/g, "")
    .replace(/\s+/g, "");
  if (!raw) return null;
  const m = raw.match(/^(\d+(?:[.,]\d+)*)(k|rb|ribu|jt|juta)?$/);
  if (!m) return null;
  const suffix = m[2] || "";
  const mult =
    suffix === "k" || suffix === "rb" || suffix === "ribu"
      ? 1_000
      : suffix === "jt" || suffix === "juta"
        ? 1_000_000
        : 1;
  let numeric = m[1];
  if (suffix) {
    // Dengan akhiran, titik/koma dibaca sebagai desimal: 1,5jt = 1.5 juta.
    const n = Number(numeric.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * mult * 100) / 100 : null;
  }
  // Tanpa akhiran: "12.500" = ribuan (grup 3 digit), "12,5" = desimal.
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(numeric)) numeric = numeric.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d+$/.test(numeric)) numeric = numeric.replace(",", ".");
  else if (/^\d+\.\d+$/.test(numeric) && !/^\d{1,3}\.\d{3}$/.test(numeric)) {
    /* desimal titik: biarkan */
  } else numeric = numeric.replace(/\./g, "");
  const n = Number(numeric);
  return Number.isFinite(n) ? n : null;
}

/** Temukan semua nominal yang JELAS uang (berawalan Rp atau berakhiran k/rb/ribu/jt/juta). */
export function findMoneyMentions(text: string): Array<{ raw: string; amount: number }> {
  const found: Array<{ raw: string; amount: number; index: number }> = [];
  const withPrefix = /\brp\.?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(?:\s*(k|rb|ribu|jt|juta)\b)?/gi;
  const withSuffix = /(?<![\w.,])(\d+(?:[.,]\d+)?)\s?(k|rb|ribu|jt|juta)\b/gi;
  const taken: Array<[number, number]> = [];
  for (const re of [withPrefix, withSuffix]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      const amount = parseMoneyId(m[0]);
      if (amount != null && amount > 0) {
        taken.push([start, end]);
        found.push({ raw: m[0].trim(), amount, index: start });
      }
    }
  }
  return found.sort((a, b) => a.index - b.index).map(({ raw, amount }) => ({ raw, amount }));
}

export function formatRupiah(amount: number): string {
  return "Rp " + Math.round(amount).toLocaleString("id-ID");
}

/* ------------------------------------------------------------------ */
/* Tanggal                                                             */
/* ------------------------------------------------------------------ */

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}
function toYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/** Tambah hari pada string YYYY-MM-DD memakai aritmetika UTC (aman dari DST/offset). */
export function addDaysYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
function weekdayOf(ymd: string): number {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function validYmd(y: number, m: number, d: number): boolean {
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Label singkat untuk chip: "Hari ini", "Besok", "Lusa", atau "Sen, 12 Okt". */
export function formatChipDate(ymd: string, todayYmd: string, lang: ChipLang = "id"): string {
  const en = lang === "en";
  if (ymd === todayYmd) return en ? "Today" : "Hari ini";
  if (ymd === addDaysYmd(todayYmd, 1)) return en ? "Tomorrow" : "Besok";
  if (ymd === addDaysYmd(todayYmd, 2)) return en ? "In 2 days" : "Lusa";
  const { y, m, d } = parseYmd(ymd);
  const sameYear = y === parseYmd(todayYmd).y;
  const day = (en ? DAY_NAMES_EN : DAY_NAMES_ID)[weekdayOf(ymd)];
  const month = (en ? MONTH_NAMES_EN : MONTH_NAMES_ID)[m - 1];
  return en ? `${day}, ${month} ${d}${sameYear ? "" : ", " + y}` : `${day}, ${d} ${month}${sameYear ? "" : " " + y}`;
}

/* ------------------------------------------------------------------ */
/* Parser utama                                                        */
/* ------------------------------------------------------------------ */

const LEAD = "(?:(?:sebelum|pada|paling\\s+lambat|selambatnya|on|by|before|due|until)\\s+)?";
const TRAILING_CONNECTORS = /\s+(?:pada|di|on|at|by|before|sebelum|untuk|for|jam|pukul|dan|and|ke|to)\s*$/i;
const LEADING_CONNECTORS = /^(?:pada|di|on|at|sebelum|untuk|dan)\s+/i;

function collapse(s: string): string {
  return s.replace(/\s{2,}/g, " ").trim();
}

function clock(h: number, min: number): string | null {
  if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function applyPeriod(h: number, period: string | undefined): number {
  const p = (period || "").toLowerCase();
  if (!p) return h;
  if (p === "pm" || p === "sore" || p === "malam") {
    if (p === "malam" && h === 12) return 0; // 12 malam = tengah malam
    return h < 12 ? h + 12 : h;
  }
  if (p === "siang") return h >= 1 && h <= 6 ? h + 12 : h; // jam 1 siang = 13:00, jam 12 siang = 12:00
  if (p === "am" || p === "pagi") return h === 12 ? 0 : h;
  return h;
}

export function parseSmartCapture(input: string, options: SmartParseOptions = {}): SmartParseResult {
  const timezone = options.timezone || "Asia/Jakarta";
  const now = options.now ?? new Date();
  const stripTags = options.stripTags !== false;
  const today = dateStrInTimezone(now, timezone);
  const original = String(input ?? "");
  let rest = ` ${original} `;

  const chips: SmartChip[] = [];
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let priority: SmartPriority | null = null;
  const tags: string[] = [];

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean): boolean => {
    const m = rest.match(re);
    if (!m || m.index == null) return false;
    if (!fn(m)) return false;
    rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
    return true;
  };

  /* 1. #tag */
  {
    const re = /(^|\s)#([\p{L}\p{N}_-]{1,32})(?=\s|[.,;!?]|$)/gu;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      const tag = m[2].toLowerCase();
      if (!seen.has(tag) && seen.size < 5) {
        seen.add(tag);
        tags.push(tag);
        chips.push({ kind: "tag", label: `#${tag}`, raw: m[0].trim() });
      }
    }
    if (stripTags) rest = rest.replace(re, "$1 ");
  }

  /* 2. Prioritas eksplisit (dibuang dari judul) */
  const setPriority = (p: SmartPriority, raw: string) => {
    if (priority) return;
    priority = p;
    chips.push({
      kind: "priority",
      label:
        options.lang === "en"
          ? p === "high"
            ? "High priority"
            : p === "low"
              ? "Low priority"
              : "Medium priority"
          : p === "high"
            ? "Prioritas tinggi"
            : p === "low"
              ? "Prioritas rendah"
              : "Prioritas sedang",
      raw: raw.trim(),
    });
  };
  take(/(^|\s)(?:!{1}([123])|p([123]))(?=\s|[.,;!?]|$)/i, (m) => {
    const n = m[2] || m[3];
    setPriority(n === "1" ? "high" : n === "2" ? "medium" : "low", m[0]);
    return true;
  });
  take(/(^|\s)!{2,3}(?=\s|[.,;!?]|$)/, (m) => {
    setPriority("high", m[0]);
    return true;
  });
  take(/\b(?:prioritas|priority)\s+(tinggi|sedang|rendah|high|medium|low|normal)\b/i, (m) => {
    const v = m[1].toLowerCase();
    setPriority(v === "tinggi" || v === "high" ? "high" : v === "rendah" || v === "low" ? "low" : "medium", m[0]);
    return true;
  });
  // Kata penanda lunak: memengaruhi prioritas tetapi TIDAK dibuang dari judul.
  if (!priority) {
    const soft = original.match(/\b(urgent|segera|asap|darurat|penting\s+banget|sangat\s+penting)\b/i);
    if (soft) setPriority("high", soft[0]);
  }

  /* 3. Tanggal eksplisit: ISO, dd/mm(/yyyy) */
  take(new RegExp(`${LEAD}\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b`, "i"), (m) => {
    const y = Number(m[1]),
      mo = Number(m[2]),
      d = Number(m[3]);
    if (!validYmd(y, mo, d)) return false;
    dueDate = toYmd(y, mo, d);
    return true;
  });
  if (!dueDate) {
    take(new RegExp(`${LEAD}(?<![\\d/])(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?(?![\\d/])`, "i"), (m) => {
      const d = Number(m[1]),
        mo = Number(m[2]);
      let y = m[3] ? Number(m[3]) : parseYmd(today).y;
      if (m[3] && m[3].length === 2) y += 2000;
      if (!validYmd(y, mo, d)) return false;
      let candidate = toYmd(y, mo, d);
      // Tanpa tahun dan sudah lewat → asumsikan tahun depan.
      if (!m[3] && candidate < today) candidate = toYmd(y + 1, mo, d);
      dueDate = candidate;
      return true;
    });
  }

  /* 3b. Kombinasi "Sabtu tanggal 26": nama hari HARUS cocok dengan tanggalnya.
         Dicari dalam 62 hari ke depan; bila tidak ada yang cocok, tidak menebak sama sekali. */
  let comboMatched = false;
  if (!dueDate) {
    const dayAlt = WEEKDAYS.map((w) => `(?:${w.re})`).join("|");
    const comboRe = new RegExp(`${LEAD}\\b(${dayAlt})\\b[\\s,]*(?:tanggal|tgl\\.?)\\s*(\\d{1,2})\\b`, "i");
    take(comboRe, (m) => {
      comboMatched = true;
      const word = m[1].replace(/\s+/g, " ");
      const wd = WEEKDAYS.find((w) => new RegExp(`^(?:${w.re})$`, "i").test(word))?.day;
      const dom = Number(m[2]);
      if (wd == null || dom < 1 || dom > 31) return false;
      for (let i = 0; i <= 62; i += 1) {
        const cand = addDaysYmd(today, i);
        if (parseYmd(cand).d === dom && weekdayOf(cand) === wd) {
          dueDate = cand;
          return true;
        }
      }
      return false;
    });
  }

  /* 4. "tanggal 26" / "tgl 26" → tanggal terdekat dengan hari-dalam-bulan itu */
  if (!dueDate && !comboMatched) {
    take(new RegExp(`${LEAD}\\b(?:tanggal|tgl\\.?)\\s*(\\d{1,2})\\b`, "i"), (m) => {
      const day = Number(m[1]);
      if (day < 1 || day > 31) return false;
      const t = parseYmd(today);
      let y = t.y,
        mo = t.m;
      for (let i = 0; i < 13; i += 1) {
        if (day <= daysInMonth(y, mo)) {
          const cand = toYmd(y, mo, day);
          if (cand >= today) {
            dueDate = cand;
            return true;
          }
        }
        mo += 1;
        if (mo > 12) {
          mo = 1;
          y += 1;
        }
      }
      return false;
    });
  }

  /* 5. Kata relatif */
  if (!dueDate) {
    const rel: Array<[RegExp, number]> = [
      [new RegExp(`${LEAD}\\b(?:hari\\s+ini|today|tonight|malam\\s+ini|nanti\\s+malam)\\b`, "i"), 0],
      [new RegExp(`${LEAD}\\b(?:besok|tomorrow|tmrw)\\b`, "i"), 1],
      [new RegExp(`${LEAD}\\b(?:lusa|day\\s+after\\s+tomorrow)\\b`, "i"), 2],
      [new RegExp(`${LEAD}\\b(?:minggu\\s+depan|pekan\\s+depan|next\\s+week)\\b`, "i"), 7],
      [new RegExp(`${LEAD}\\b(?:bulan\\s+depan|next\\s+month)\\b`, "i"), 30],
    ];
    for (const [re, days] of rel) {
      if (dueDate) break;
      take(re, (m) => {
        const isTonight = /malam|tonight/i.test(m[0]);
        dueDate = addDaysYmd(today, days);
        if (isTonight && !dueTime) dueTime = "19:00";
        return true;
      });
    }
  }
  if (!dueDate) {
    take(new RegExp(`${LEAD}\\b(\\d{1,3})\\s*(?:hari|minggu|pekan)\\s+lagi\\b`, "i"), (m) => {
      const n = Number(m[1]);
      if (n < 1 || n > 365) return false;
      const unit = /minggu|pekan/i.test(m[0]) ? 7 : 1;
      dueDate = addDaysYmd(today, n * unit);
      return true;
    });
  }
  if (!dueDate) {
    take(new RegExp(`${LEAD}\\bin\\s+(\\d{1,3})\\s+(day|days|week|weeks)\\b`, "i"), (m) => {
      const n = Number(m[1]);
      if (n < 1 || n > 365) return false;
      dueDate = addDaysYmd(today, /week/i.test(m[2]) ? n * 7 : n);
      return true;
    });
  }

  /* 6. Nama hari (hari terdekat SETELAH hari ini; "depan"/"next" ditelan) */
  for (const { re, day } of comboMatched ? [] : WEEKDAYS) {
    const rx = new RegExp(`${LEAD}\\b(?:${re})\\b(?:\\s+(?:depan|ini|next|this))?(?!\\s+lalu\\b)`, "i");
    take(rx, () => {
      if (!dueDate) {
        const delta = (day - weekdayOf(today) + 7) % 7 || 7;
        dueDate = addDaysYmd(today, delta);
      }
      return true; // hari tetap dibuang dari judul walau tanggal sudah ditentukan "tanggal N"
    });
  }

  /* 7. Jam */
  take(/(?:\b(?:jam|pukul|at)|@)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|am|pm)?(?![\w:.]\d)\b/i, (m) => {
    const h = applyPeriod(Number(m[1]), m[3]);
    const t = clock(h, m[2] ? Number(m[2]) : 0);
    if (!t) return false;
    dueTime = t;
    return true;
  });
  if (!dueTime) {
    take(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i, (m) => {
      const t = clock(applyPeriod(Number(m[1]), m[3]), m[2] ? Number(m[2]) : 0);
      if (!t) return false;
      dueTime = t;
      return true;
    });
  }
  if (!dueTime) {
    take(/(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/, (m) => {
      const t = clock(Number(m[1]), Number(m[2]));
      if (!t) return false;
      dueTime = t;
      return true;
    });
  }
  // Kata "pagi/siang/sore/malam" berdiri sendiri (tanpa angka) tidak diubah menjadi jam.

  /* 8. Uang (informasi saja; tidak dibuang dari judul) */
  const money = findMoneyMentions(original);
  const amount = money.length ? money[0].amount : null;
  for (const mm of money.slice(0, 3)) chips.push({ kind: "money", label: formatRupiah(mm.amount), raw: mm.raw });

  /* 9. Chip tanggal & jam di urutan paling depan */
  const lead: SmartChip[] = [];
  if (dueDate) lead.push({ kind: "date", label: formatChipDate(dueDate, today, options.lang ?? "id"), raw: "" });
  if (dueTime) lead.push({ kind: "time", label: dueTime, raw: "" });
  const orderedChips = [...lead, ...chips];

  /* 10. Judul bersih */
  let title = collapse(rest);
  for (let i = 0; i < 3; i += 1) {
    title = title.replace(TRAILING_CONNECTORS, "").replace(LEADING_CONNECTORS, "").trim();
  }
  title = title.replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, "").trim();
  if (!title) title = collapse(original);

  return { original, title, dueDate, dueTime, priority, tags, amount, chips: orderedChips };
}

/**
 * Ubah hasil parse menjadi ISO UTC untuk kolom due_at. Bila hanya tanggal yang diketahui,
 * `defaultTime` dipakai (default 09:00 waktu lokal). Null bila tidak ada tanggal.
 */
export function smartDueAtIso(
  result: Pick<SmartParseResult, "dueDate" | "dueTime">,
  timezone = "Asia/Jakarta",
  defaultTime = "09:00",
): string | null {
  if (!result.dueDate) return null;
  return localDateTimeToIso(result.dueDate, result.dueTime || defaultTime, timezone);
}
