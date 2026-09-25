import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`reminder-test:${user.id}`, 5, 60_000);
  if (gate) return gate;
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const remindAt = new Date(Date.now() + 60_000).toISOString();
  const { data, error } = await supabase.from("reminders").insert({
    user_id: user.id,
    title: "Tes pengingat Licia",
    body: "Reminder uji satu menit. Tetap buka Licia untuk fallback browser atau aktifkan Web Push untuk perangkat.",
    remind_at: remindAt,
    timezone: profile?.timezone || "Asia/Jakarta",
    target_type: "custom",
    href: "/system",
    enabled: true,
    status: "pending",
    updated_at: new Date().toISOString(),
  }).select("id,title,remind_at,status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, reminder: data });
}
