export const DEFAULT_LICIA_AI_MODEL = "gpt-6-luna";

export type AiModelRouteInput = {
  text: string;
  hasImage?: boolean;
  domains?: string[];
  mode?: string;
};

const HEAVY_INTENT_ID =
  /\b(analisis|jelaskan|bandingkan|rencanakan|susun|kenapa|strategi|review|evaluasi|hubungkan|ringkas|teliti|jadwalkan|hapus|ubah|ganti|edit|revisi|perbaiki|buatkan|atur)\b/i;
const HEAVY_INTENT_EN =
  /\b(analy[sz]e|explain|compare|plan|organi[sz]e|why|strategy|evaluate|summari[sz]e|schedule|delete|remove|change|update|rename|fix|create|reschedule|prioriti[sz]e|break down)\b/i;
const TIME_WORDS =
  /\b(sabtu|minggu|senin|selasa|rabu|kamis|jumat|besok|lusa|tanggal|jam|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|date|o'clock)\b/i;
const SCHEDULE_WORDS = /\b(jadwal|kalender|agenda|ingatkan|reminder|schedule|calendar|remind)\b/i;

export function selectAiModel(input: AiModelRouteInput) {
  const explicit = process.env.LICIA_AI_MODEL?.trim() || DEFAULT_LICIA_AI_MODEL;
  const heavy = process.env.LICIA_AI_HEAVY_MODEL?.trim() || explicit;
  const text = input.text || "";
  const complexity =
    Boolean(input.hasImage) ||
    text.length > 900 ||
    HEAVY_INTENT_ID.test(text) ||
    HEAVY_INTENT_EN.test(text) ||
    (TIME_WORDS.test(text) && SCHEDULE_WORDS.test(text)) ||
    (input.domains?.length ?? 0) >= 3 ||
    input.mode === "planner" ||
    input.mode === "analyst";

  return complexity ? heavy : explicit;
}

export function selectAiToolModel(input: AiModelRouteInput) {
  return process.env.LICIA_AI_TOOL_MODEL?.trim() || selectAiModel(input);
}

export function aiRoutingSummary(input: AiModelRouteInput) {
  const model = selectAiModel(input);
  return {
    model,
    toolModel: selectAiToolModel(input),
    configuredHeavyModel: Boolean(process.env.LICIA_AI_HEAVY_MODEL?.trim()),
    configuredToolModel: Boolean(process.env.LICIA_AI_TOOL_MODEL?.trim()),
  };
}

/** Model cadangan bila model utama error/overload (LICIA_AI_FALLBACK_MODEL). */
export function selectAiFallbackModel(primary: string): string | null {
  const fb = process.env.LICIA_AI_FALLBACK_MODEL?.trim();
  return fb && fb !== primary ? fb : null;
}
