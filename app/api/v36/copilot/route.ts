import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { buildCopilotContext } from "@/lib/v36/intelligence";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const payload = await buildCopilotContext(supabase, user.id, String(profile?.timezone || "Asia/Jakarta"));
  return NextResponse.json({ ok: true, ...payload }, { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=40" } });
}
