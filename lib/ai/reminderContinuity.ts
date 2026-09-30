import { dateStrInTimezone, ensureTimezoneOffset, offsetForTimezone } from "@/lib/date";

const MONTHS: Record<string, number> = {
  januari: 1, jan: 1, februari: 2, feb: 2, maret: 3, mar: 3, april: 4, apr: 4,
  mei: 5, june: 6, juni: 6, july: 7, juli: 7, agustus: 8, agu: 8, september: 9, sep: 9,
  oktober: 10, okt: 10, november: 11, nov: 11, desember: 12, des: 12,
};

function getText(message: any): string {
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) return message.content.map((part: any) => typeof part?.text === "string" ? part.text : "").join(" ");
  return "";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDateLabel(text: string, reference: Date, timezone: string): string | null {
  const lower = text.toLowerCase();
  const explicitIso = lower.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (explicitIso) return `${explicitIso[1]}-${String(Number(explicitIso[2])).padStart(2, "0")}-${String(Number(explicitIso[3])).padStart(2, "0")}`;
  const named = lower.match(/\b(\d{1,2})\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|september|sep|oktober|okt|november|nov|desember|des)(?:\s+(20\d{2}))?\b/);
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2]];
    const current = dateStrInTimezone(reference, timezone);
    let year = named[3] ? Number(named[3]) : Number(current.slice(0, 4));
    const explicit = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!named[3] && explicit < current) year += 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/\bhari ini\b|\btoday\b/.test(lower)) return dateStrInTimezone(reference, timezone);
  if (/\bbesok\b|\btomorrow\b/.test(lower)) return dateStrInTimezone(addDays(reference, 1), timezone);
  if (/\blusa\b/.test(lower)) return dateStrInTimezone(addDays(reference, 2), timezone);
  return null;
}

function parseTime(text: string): { hour: number; minute: number } | null {
  const lower = text.toLowerCase();
  const clock = lower.match(/\b(?:jam|pukul)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam)?\b/);
  const fallback = clock || lower.match(/\b(\d{1,2})[.:](\d{2})\s*(pagi|siang|sore|malam)?\b/);
  if (!fallback) return null;
  let hour = Number(fallback[1]);
  const minute = Number(fallback[2] || 0);
  const period = fallback[3];
  if (hour > 23 || minute > 59) return null;
  if (period === "pagi" && hour === 12) hour = 0;
  else if ((period === "siang" || period === "sore" || period === "malam") && hour < 12) hour += 12;
  return { hour, minute };
}

function extractTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const after = normalized.replace(/^.*?\b(?:ingatkan(?: saya)?|pengingat(?: untuk saya)?|reminder(?: untuk saya)?)\b\s*/i, "");
  const stripped = after.replace(/\b(?:besok|lusa|hari ini|tanggal\s+\d{1,2}\s+\w+)\b/ig, "").replace(/\b(?:jam|pukul)\s*\d{1,2}(?::\d{2})?\s*(?:pagi|siang|sore|malam)?\b/ig, "").replace(/\bkarena\b.*$/i, "").trim();
  const title = stripped.replace(/^untuk\s+/i, "").replace(/^[,:-]+|[,:-]+$/g, "").trim();
  return title ? title.slice(0, 120) : "Pengingat Licia";
}

export type ReminderContinuity = {
  sourceText: string;
  title: string;
  body: string | null;
  remindAt: string;
  timezoneOffset: string;
};

export function detectReminderContinuity(history: any[], currentMessage: string, timezone: string, reference: Date = new Date()): ReminderContinuity | null {
  const confirmation = /^(?:oke|ok|iya|ya|yes|siap|buatkan|buat aja|lanjut|lanjutkan|silakan|boleh|gas|jadi)\s*[!.?]*$/i.test(currentMessage.trim());
  if (!confirmation) return null;
  const candidates = (history || []).filter((message) => message?.role === "user").map(getText).filter(Boolean).reverse();
  const sourceText = candidates.find((text) => /\b(ingatkan|pengingat|reminder)\b/i.test(text) && parseTime(text));
  if (!sourceText) return null;

  const allRecent = (history || []).slice(-10).map(getText).join("\n");
  const dateLabel = parseDateLabel(sourceText, reference, timezone) || parseDateLabel(allRecent, reference, timezone) || dateStrInTimezone(addDays(reference, 1), timezone);
  const time = parseTime(sourceText);
  if (!time) return null;
  const offset = offsetForTimezone(timezone);
  const naive = `${dateLabel}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00${offset}`;
  const normalized = ensureTimezoneOffset(naive, timezone);
  if (!normalized) return null;
  const ms = new Date(normalized).getTime();
  if (!Number.isFinite(ms) || ms <= reference.getTime() - 60_000) return null;

  const reason = sourceText.match(/\bkarena\b\s+(.+)$/i)?.[1]?.trim();
  return {
    sourceText,
    title: extractTitle(sourceText),
    body: reason ? reason.slice(0, 500) : sourceText.slice(0, 500),
    remindAt: new Date(ms).toISOString(),
    timezoneOffset: offset,
  };
}
