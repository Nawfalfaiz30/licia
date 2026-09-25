import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildActionableContext } from "@/lib/ai/contextEngine";
import { enforceSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const context = await buildActionableContext(supabase, user.id, profile?.timezone || "Asia/Jakarta");
  return NextResponse.json(context, { headers: { "Cache-Control": "private, no-store" } });
}
