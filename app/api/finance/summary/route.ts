import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const url = new URL(req.url);
  const requestedRange = Number(url.searchParams.get("range") || 6);
  const range = Number.isFinite(requestedRange) ? Math.max(1, Math.min(24, Math.floor(requestedRange))) : 6;

  const { data: profile } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  const { data, error } = await supabase.rpc("licia_get_finance_summary", {
    p_range_months: range,
    p_timezone: profile?.timezone || "Asia/Jakarta",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, summary: data || {} }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
