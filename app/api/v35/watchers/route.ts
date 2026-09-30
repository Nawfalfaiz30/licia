import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, assertJsonSize } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data, error } = await supabase.from("ai_watchers").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, watchers: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const body = await req.json().catch(() => ({}));
  try { assertJsonSize(body, 20_000); } catch { return NextResponse.json({ error: "Input terlalu besar." }, { status: 413 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const row = {
    user_id: user.id,
    name: String(body?.name || "Pengawas baru").slice(0, 120),
    description: String(body?.description || "").slice(0, 1000) || null,
    entity_type: String(body?.entityType || "life_os"),
    condition: body?.condition && typeof body.condition === "object" ? body.condition : {},
    action: body?.action && typeof body.action === "object" ? body.action : {},
    enabled: body?.enabled !== false,
    cooldown_minutes: Math.max(5, Math.min(10080, Number(body?.cooldownMinutes || 1440))),
  };
  const { data, error } = await supabase.from("ai_watchers").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, watcher: data });
}

export async function PATCH(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const body = await req.json().catch(() => ({}));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "ID watcher wajib diisi." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "description", "entity_type", "condition", "action", "enabled", "cooldown_minutes"]) if (body[key] !== undefined) patch[key] = body[key];
  const { data, error } = await supabase.from("ai_watchers").update(patch).eq("id", id).eq("user_id", user.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, watcher: data });
}

export async function DELETE(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const body = await req.json().catch(() => ({}));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "ID watcher wajib diisi." }, { status: 400 });
  const { error } = await supabase.from("ai_watchers").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
