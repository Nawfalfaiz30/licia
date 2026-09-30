import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertJsonSize, enforceSameOrigin, rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const sizeError = assertJsonSize(req, 64 * 1024);
  if (sizeError) return sizeError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`push-subscribe:${user.id}`, 10, 60_000);
  if (gate) return gate;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Payload subscription tidak valid." }, { status: 400 }); }
  const sub = body?.subscription;
  if (!sub || typeof sub !== "object" || typeof sub.endpoint !== "string" || typeof sub.keys?.p256dh !== "string" || typeof sub.keys?.auth !== "string") {
    return NextResponse.json({ error: "Subscription push tidak lengkap." }, { status: 400 });
  }
  if (sub.endpoint.length > 4096 || sub.keys.p256dh.length > 512 || sub.keys.auth.length > 512) {
    return NextResponse.json({ error: "Subscription push terlalu besar." }, { status: 400 });
  }
  try {
    const endpoint = new URL(sub.endpoint);
    if (endpoint.protocol !== "https:") return NextResponse.json({ error: "Endpoint push harus menggunakan HTTPS." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Endpoint push tidak valid." }, { status: 400 });
  }
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: String(sub.endpoint).trim(),
    subscription: sub,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
    enabled: true,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "";
  if (!endpoint) return NextResponse.json({ error: "Endpoint wajib." }, { status: 400 });
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
