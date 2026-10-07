import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { buildDailyBrain } from "@/lib/v35/brain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  return NextResponse.json(await buildDailyBrain(supabase, user.id, String(profile?.timezone || "Asia/Jakarta")), {
    headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
  });
}
