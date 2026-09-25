import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ notifications: [] }, { status: 401 });
  const gate = rateLimit(`notifications:${user.id}`, 60, 60_000);
  if (gate) return gate;
  const limit = Math.min(50, Math.max(10, Number(new URL(req.url).searchParams.get("limit")) || 30));
  const { data, error } = await supabase.from("notification_events").select("id,title,body,href,tone,source_type,source_id,scheduled_at,delivered_at,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notifications: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  let body: any; try { body = await req.json(); } catch { body = {}; }
  const now = new Date().toISOString();
  if (body?.all === true) {
    const { error } = await supabase.from("notification_events").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "ID notifikasi wajib." }, { status: 400 });
  const { error } = await supabase.from("notification_events").update({ read_at: now }).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
