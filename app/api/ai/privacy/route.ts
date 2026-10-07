import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, assertJsonSize } from "@/lib/security";

export async function GET(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data, error } = await supabase.from("ai_privacy_preferences")
    .select("exclude_finance,exclude_health,private_mode,log_retention_days,updated_at")
    .eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Preferensi privasi gagal dibaca." }, { status: 500 });
  return NextResponse.json({ preferences: data || { exclude_finance:false, exclude_health:false, private_mode:false, log_retention_days:90 } });
}

export async function PATCH(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const size = assertJsonSize(req, 16 * 1024);
  if (size) return size;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  const patch = {
    exclude_finance: body.exclude_finance === true,
    exclude_health: body.exclude_health === true,
    private_mode: body.private_mode === true,
    log_retention_days: Math.max(7, Math.min(3650, Number(body.log_retention_days ?? 90))),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("ai_privacy_preferences")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
    .select("exclude_finance,exclude_health,private_mode,log_retention_days,updated_at").single();
  if (error) return NextResponse.json({ error: "Preferensi privasi gagal disimpan." }, { status: 500 });
  return NextResponse.json({ ok: true, preferences: data });
}
