import { NextResponse } from "next/server";

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { dateStrInTimezone, offsetForTimezone } from "@/lib/date";
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
type InputItem = { id?: string; content: string };

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const sizeError = assertJsonSize(req, 128 * 1024); if (sizeError) return sizeError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`inbox-triage:${user.id}`, 12, 60_000); if (gate) return gate;
  const body = await req.json().catch(() => ({}));
  const rawItems = Array.isArray(body.items) ? body.items : [{ content: body.content }];
  const items: InputItem[] = rawItems.filter((x: any) => typeof x?.content === "string" && x.content.trim()).slice(0, 20);
  if (!items.length) return NextResponse.json({ error: "Isi belum tersedia." }, { status: 400 });

  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();
  const resolved = profile ?? await getOrCreateProfile(supabase, user.id, user.user_metadata?.display_name);
  const timezone = (resolved as any)?.timezone ?? "Asia/Jakarta";
  const today = dateStrInTimezone(new Date(), timezone);
  const offset = offsetForTimezone(timezone);
  try {
    const completion = await withOpenAIRetry(() => getOpenAI().chat.completions.create({
      model: "gpt-4o-mini", temperature: 0.1, response_format: { type: "json_object" }, max_tokens: 900,
      messages: [
        { role: "system", content: `Kamu adalah mesin triase Smart Inbox. Hari ini ${today} dalam zona ${timezone}. Untuk setiap item pilih tepat satu kind: task,note,idea,decision,learning. Buat title ringkas, reason satu kalimat, priority low/medium/high. due_at hanya jika deadline jelas dan pakai offset ${offset}; jangan mengarang. Balikkan JSON {"items":[{"id":string,"kind":string,"title":string,"reason":string,"due_at":string|null,"priority":string}]}.` },
        { role: "user", content: JSON.stringify(items.map((x, i) => ({ id: x.id ?? String(i), content: x.content }))) },
      ],
    }), 2);
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const out = (Array.isArray(parsed.items) ? parsed.items : []).map((x: any, i: number) => ({
      id: String(x.id ?? items[i]?.id ?? i),
      kind: ["task","note","idea","decision","learning"].includes(x.kind) ? x.kind : "note",
      title: typeof x.title === "string" && x.title.trim() ? x.title.trim() : (items[i]?.content || "").slice(0, 90),
      reason: typeof x.reason === "string" ? x.reason : "",
      due_at: typeof x.due_at === "string" ? x.due_at : null,
      priority: ["low","medium","high"].includes(x.priority) ? x.priority : "medium",
    }));
    return NextResponse.json({ items: out, ...(out.length === 1 ? out[0] : {}) });
  } catch {
    return NextResponse.json({
      items: items.map((x) => ({ id: x.id, kind: "note", title: x.content.slice(0, 90), reason: "Triage otomatis belum tersedia; pilih jalur secara manual.", due_at: null, priority: "medium" })),
      fallback: true,
      fallbackReason: "AI tidak tersedia; item ditampilkan sebagai catatan agar data tetap bisa diproses."
    });
  }
}
