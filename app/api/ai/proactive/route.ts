import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, assertJsonSize } from "@/lib/security";

export async function GET(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data, error } = await supabase
    .from("ai_proactive_preferences")
    .select(
      "enabled,max_suggestions_per_day,quiet_start,quiet_end,allow_finance,allow_health,allow_schedule,allow_tasks,updated_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Preferensi proaktif gagal dibaca." }, { status: 500 });
  return NextResponse.json({
    preferences: data || {
      enabled: true,
      max_suggestions_per_day: 3,
      quiet_start: null,
      quiet_end: null,
      allow_finance: true,
      allow_health: true,
      allow_schedule: true,
      allow_tasks: true,
    },
  });
}

export async function PATCH(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const size = assertJsonSize(req, 16 * 1024);
  if (size) return size;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  const patch = {
    enabled: body.enabled !== false,
    max_suggestions_per_day: Math.max(0, Math.min(24, Number(body.max_suggestions_per_day ?? 3))),
    quiet_start: typeof body.quiet_start === "string" ? body.quiet_start.slice(0, 5) : null,
    quiet_end: typeof body.quiet_end === "string" ? body.quiet_end.slice(0, 5) : null,
    allow_finance: body.allow_finance !== false,
    allow_health: body.allow_health !== false,
    allow_schedule: body.allow_schedule !== false,
    allow_tasks: body.allow_tasks !== false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("ai_proactive_preferences")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
    .select(
      "enabled,max_suggestions_per_day,quiet_start,quiet_end,allow_finance,allow_health,allow_schedule,allow_tasks,updated_at",
    )
    .single();
  if (error) return NextResponse.json({ error: "Preferensi proaktif gagal disimpan." }, { status: 500 });
  return NextResponse.json({ ok: true, preferences: data });
}
