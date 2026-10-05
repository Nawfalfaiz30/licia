import { resolveNaturalDate, validateWeekdayDate, buildTemporalContext, type ResolvedDate } from "@/lib/v36/temporal";
import { dateStrInTimezone } from "@/lib/date";

export function hasTemporalIntent(text: string) {
  return /\b(hari ini|besok|lusa|kemarin|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|tanggal|\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2})\b/i.test(text)
    || /\b(jadwal|kalender|agenda|meeting|rapat|kelas|kuliah|pengingat|reminder)\b/i.test(text);
}

export type TemporalGuard = {
  active: boolean;
  reference: string;
  timezone: string;
  temporalContext: ReturnType<typeof buildTemporalContext>;
  resolved: ResolvedDate[];
  weekdayValidation?: ReturnType<typeof validateWeekdayDate>;
  instruction: string;
};

export function buildTemporalGuard(input: string, referenceDate: Date, timezone: string): TemporalGuard {
  const text = String(input || "").trim();
  const active = hasTemporalIntent(text);
  const temporalContext = buildTemporalContext(referenceDate, timezone);
  if (!active) {
    return {
      active: false,
      reference: dateStrInTimezone(referenceDate, timezone),
      timezone,
      temporalContext,
      resolved: [],
      instruction: "Tidak ada guard tanggal khusus untuk pesan ini.",
    };
  }

  const resolved = resolveNaturalDate(text, referenceDate, timezone);
  const weekdayMatch = text.match(/\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)\b/i)?.[1] || null;
  const explicitDate = resolved[0]?.date || null;
  const weekdayValidation = weekdayMatch && explicitDate
    ? validateWeekdayDate(explicitDate, weekdayMatch, timezone)
    : undefined;

  const chosen = resolved[0];
  const detail = chosen
    ? `Tanggal hasil engine: ${chosen.date} (${chosen.weekday}); sumber=${chosen.source}; confidence=${chosen.confidence}.`
    : "Engine belum menemukan tanggal pasti.";

  return {
    active: true,
    reference: temporalContext.today,
    timezone,
    temporalContext,
    resolved,
    weekdayValidation,
    instruction: [
      "TEMPORAL GUARD AKTIF: tanggal/waktu harus mengikuti engine deterministik, bukan tebakan model.",
      `Tanggal referensi lokal: ${temporalContext.today} (${temporalContext.weekday}), sekarang ${temporalContext.nowIso}.`,
      detail,
      weekdayValidation && !weekdayValidation.valid
        ? `PERINGATAN: tanggal ${explicitDate} sebenarnya ${weekdayValidation.actualWeekday}, bukan ${weekdayValidation.expectedWeekday}. Jangan menyatakan keduanya cocok.`
        : "Jika pengguna menyebut hari + nomor tanggal, gunakan pasangan yang telah divalidasi dan panggil resolve_calendar_date sebelum membaca/mengubah kalender.",
    ].join("\n"),
  };
}
