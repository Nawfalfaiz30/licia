import { resolveNaturalDate } from "@/lib/v36/temporal";

export type VisionScheduleBlock = {
  weekday?: string | null;
  block_date?: string | null;
  date_text?: string | null;
  start_time: string;
  end_time: string;
  title: string;
  location?: string | null;
  description?: string | null;
  source_type?: "email" | "calendar" | "schedule_table" | "document" | "unknown";
};

const WEEKDAYS: Record<string, string> = {
  senin: "senin",
  monday: "senin",
  selasa: "selasa",
  tuesday: "selasa",
  rabu: "rabu",
  wednesday: "rabu",
  kamis: "kamis",
  thursday: "kamis",
  jumat: "jumat",
  "jum'at": "jumat",
  friday: "jumat",
  sabtu: "sabtu",
  saturday: "sabtu",
  minggu: "minggu",
  sunday: "minggu",
};

const WEEKDAY_INDEX = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

const MONTHS: Record<string, number> = {
  januari: 1,
  january: 1,
  februari: 2,
  february: 2,
  maret: 3,
  march: 3,
  april: 4,
  mei: 5,
  may: 5,
  juni: 6,
  june: 6,
  juli: 7,
  july: 7,
  agustus: 8,
  august: 8,
  september: 9,
  oktober: 10,
  october: 10,
  november: 11,
  desember: 12,
  december: 12,
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function normalizeWeekday(value: unknown): string | null {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  return WEEKDAYS[key] ?? null;
}

function normalizeTime(value: unknown): string | null {
  const raw = String(value ?? "")
    .trim()
    .replace(/\./g, ":");
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

/**
 * Convert dates commonly found in email confirmations into a concrete ISO date.
 * We deliberately refuse to guess the year when the source does not provide one.
 */
export function parseVisionDate(value: unknown, referenceDate: Date, timezone: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const text = raw.replace(/,/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("id-ID");

  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (slash) return validDate(Number(slash[3]), Number(slash[2]), Number(slash[1]));

  const dayMonthYear = text.match(
    /\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|may|june|july|august|october|december)\s+(20\d{2})\b/i,
  );
  if (dayMonthYear) {
    return validDate(Number(dayMonthYear[3]), MONTHS[dayMonthYear[2].toLowerCase()], Number(dayMonthYear[1]));
  }

  const monthDayYear = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(20\d{2})\b/i,
  );
  if (monthDayYear) {
    return validDate(Number(monthDayYear[3]), MONTHS[monthDayYear[1].toLowerCase()], Number(monthDayYear[2]));
  }

  const verbose = text.match(
    /\btanggal\s+(\d{1,2})(?:\s+bulan)?\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(?:tahun\s+)?(20\d{2})\b/i,
  );
  if (verbose) {
    return validDate(Number(verbose[3]), MONTHS[verbose[2].toLowerCase()], Number(verbose[1]));
  }

  const resolved = resolveNaturalDate(text, referenceDate, timezone)[0];
  if (
    resolved?.confidence === "high" &&
    /\b(20\d{2}|tanggal|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(
      text,
    )
  ) {
    return resolved.date;
  }
  return null;
}

export function weekdayFromDate(blockDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) return null;
  const [year, month, day] = blockDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (!Number.isFinite(date.getTime())) return null;
  return WEEKDAY_INDEX[date.getUTCDay()] ?? null;
}

/**
 * Normalize vision output without throwing away events just because the image
 * is an email/document rather than a weekly timetable.
 */
export function normalizeVisionScheduleBlocks(
  value: unknown,
  referenceDate: Date,
  timezone: string,
): VisionScheduleBlock[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: VisionScheduleBlock[] = [];

  for (const raw of value.slice(0, 30)) {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const rawDate = item.block_date ?? item.date ?? item.event_date ?? item.date_text;
    const blockDate = parseVisionDate(rawDate, referenceDate, timezone);
    const weekday = normalizeWeekday(item.weekday) ?? (blockDate ? weekdayFromDate(blockDate) : null);
    const start = normalizeTime(item.start_time ?? item.start ?? item.time_start);
    const end = normalizeTime(item.end_time ?? item.end ?? item.time_end);
    const title = String(item.title ?? item.event_title ?? item.subject ?? item.activity ?? "").trim();

    if (!start || !end || start >= end || !title) continue;
    if (!blockDate && !weekday) continue;

    const key = `${blockDate ?? weekday}|${start}|${end}|${title.toLocaleLowerCase("id-ID")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sourceRaw = String(item.source_type ?? "unknown").toLowerCase();
    const source_type =
      sourceRaw === "email" || sourceRaw === "calendar" || sourceRaw === "schedule_table" || sourceRaw === "document"
        ? sourceRaw
        : "unknown";

    result.push({
      block_date: blockDate,
      weekday,
      date_text: typeof item.date_text === "string" ? item.date_text.trim() || null : null,
      start_time: start,
      end_time: end,
      title,
      location: typeof item.location === "string" ? item.location.trim() || null : null,
      description: typeof item.description === "string" ? item.description.trim() || null : null,
      source_type,
    });
  }

  return result;
}

export function buildVisionSchedulePrompt(userInstruction: string) {
  return `Baca gambar berikut sebagai dokumen visual yang mungkin berisi JADWAL, EMAIL KONFIRMASI, UNDANGAN, KALENDER, atau dokumen acara. KELUARKAN JSON SAJA. Jangan menebak informasi yang tidak terlihat.

Instruksi pengguna: ${userInstruction || "Baca dan pahami gambar ini."}

FORMAT WAJIB:
{
  "source_type": "email|calendar|schedule_table|document|unknown",
  "blocks": [
    {
      "block_date": "YYYY-MM-DD atau null",
      "date_text": "teks tanggal seperti terlihat atau null",
      "weekday": "senin|selasa|rabu|kamis|jumat|sabtu|minggu atau null",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "title": "judul acara/kegiatan",
      "location": "lokasi yang terlihat atau null",
      "description": "detail penting yang terlihat atau null",
      "source_type": "email|calendar|schedule_table|document|unknown"
    }
  ],
  "notes": []
}

ATURAN PENTING:
- Untuk EMAIL KONFIRMASI, cari pasangan informasi seperti “Interview date”, “Interview time”, “Meeting date”, “Event date”, “Appointment date”, “Date”, “Time”, “Recruitment Stage”, “Reservation”, dan subject email.
- Jika tanggal kalender TERTULIS JELAS (misalnya “tanggal 2 bulan Oktober tahun 2026”), isi block_date langsung sebagai “2026-10-02”. Jangan menunggu nama hari.
- Jika tanggal hanya tertulis sebagai hari tanpa tanggal kalender, biarkan block_date null dan isi weekday.
- Jika jam berbentuk rentang seperti “14:20 - 15:20”, isi start_time=14:20 dan end_time=15:20.
- Jangan mengubah judul menjadi ringkasan pendek bila judul acara sudah jelas. Pertahankan identitas acara yang terlihat.
- Jangan mengarang timezone. Timezone akan ditangani oleh server Licia.
- Untuk email, sender/recipient bukan event title kecuali memang itu satu-satunya nama acara.
- Simpan nomor kandidat, stage rekrutmen, atau detail penting lain di description bila terlihat dan relevan.
- Setiap acara = satu block. Jangan menggabungkan dua acara yang berbeda.
- Jika ada satu tanggal dan satu rentang waktu yang jelas pada email konfirmasi, hasilkan satu block walaupun layout-nya bukan tabel.
- Jika salah satu bagian tidak terlihat, jangan mengarang; masukkan alasan di notes.

Jangan berikan markdown. JSON murni saja.`;
}
