import { NextResponse } from "next/server";

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { assertJsonSize, enforceSameOrigin, rateLimit } from "@/lib/security";
import { withOpenAIRetry } from "@/lib/ai/runtime";

export const runtime = "nodejs";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY belum dikonfigurasi di server.");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

// Small, focused endpoint: given a food description, ask the model for a rough
// nutrition estimate. Used by the Health page's manual "Catat" button so every
// meal gets an estimate, not just ones logged through the main chat.
export async function POST(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const sizeError = assertJsonSize(req, 32 * 1024); if (sizeError) return sizeError;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Belum masuk (unauthorized)." }, { status: 401 });
  }
  const gate = rateLimit(`nutrition:${user.id}`, 20, 60_000); if (gate) return gate;

  const { description } = (await req.json()) as { description: string };
  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "Deskripsi makanan kosong." }, { status: 400 });
  }

  try {
    const completion = await withOpenAIRetry(() => getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Kamu ahli gizi. Diberi deskripsi makanan (sering dalam Bahasa Indonesia, termasuk makanan Indonesia), " +
            "berikan PERKIRAAN kasar kandungan gizinya untuk satu porsi wajar. Balas HANYA JSON " +
            'dengan format persis: {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}. ' +
            "Kalau deskripsi terlalu tidak jelas untuk diperkirakan, tetap beri angka masuk akal untuk porsi " +
            "sedang daripada menolak.",
        },
        { role: "user", content: description },
      ],
    }), 2);

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json({
      ok: true,
      calories: Number(parsed.calories) || null,
      protein_g: Number(parsed.protein_g) || null,
      carbs_g: Number(parsed.carbs_g) || null,
      fat_g: Number(parsed.fat_g) || null,
    });
  } catch (error) {
    console.error("Licia nutrition estimate failed", error);
    return NextResponse.json({
      ok: false,
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      error: error instanceof Error && error.message.includes("OPENAI_API_KEY")
        ? "Layanan AI belum dikonfigurasi di server."
        : "Estimasi gizi AI sedang tidak tersedia."
    });
  }
}
