export type AiModelRouteInput = {
  text: string;
  hasImage?: boolean;
  domains?: string[];
  mode?: string;
};

export function selectAiModel(input: AiModelRouteInput) {
  const explicit = process.env.LICIA_AI_MODEL?.trim();
  const heavy = process.env.LICIA_AI_HEAVY_MODEL?.trim();
  if (explicit) return explicit;

  const text = input.text || "";
  const complexity =
    Boolean(input.hasImage) ||
    text.length > 900 ||
    /\b(analisis|analisis|jelaskan|bandingkan|rencanakan|susun|kenapa|strategi|review|evaluasi|hubungkan|ringkas|teliti)\b/i.test(text) ||
    (input.domains?.length ?? 0) >= 3;

  return complexity && heavy ? heavy : "gpt-4o-mini";
}

export function aiRoutingSummary(input: AiModelRouteInput) {
  const model = selectAiModel(input);
  return { model, configuredHeavyModel: Boolean(process.env.LICIA_AI_HEAVY_MODEL?.trim()) };
}
