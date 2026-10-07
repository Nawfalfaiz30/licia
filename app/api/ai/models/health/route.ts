import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";

const MODEL_ENV_KEYS = [
  "LICIA_AI_MODEL",
  "LICIA_AI_HEAVY_MODEL",
  "LICIA_AI_TOOL_MODEL",
  "LICIA_AI_FALLBACK_MODEL",
] as const;

export async function GET(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit("ai-model-health:" + user.id, 5, 300_000);
  if (gate) return gate;
  const key = process.env.OPENAI_API_KEY?.trim();
  const configured = Object.fromEntries(MODEL_ENV_KEYS.map((k) => [k, process.env[k]?.trim() || null]));
  const models = [...new Set(Object.values(configured).filter(Boolean) as string[])];
  const result: { model: string; ok: boolean; error?: string }[] = [];
  if (!key) {
    return NextResponse.json(
      { ok: false, configured, models, result: [], error: "OPENAI_API_KEY belum dikonfigurasi." },
      { status: 503 },
    );
  }
  const client = new OpenAI({ apiKey: key });
  for (const model of models) {
    try {
      await client.models.retrieve(model);
      result.push({ model, ok: true });
    } catch (error) {
      result.push({
        model,
        ok: false,
        error: error instanceof Error ? error.message : "Model tidak dapat diverifikasi.",
      });
    }
  }
  return NextResponse.json({
    ok: result.length > 0 && result.every((x) => x.ok),
    configured,
    models: result,
    checkedAt: new Date().toISOString(),
  });
}
