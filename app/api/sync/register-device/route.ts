import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const deviceId = String(body?.deviceId || "").trim();
  if (!deviceId || deviceId.length > 160) return NextResponse.json({ error: "deviceId tidak valid." }, { status: 400 });
  const { data, error } = await supabase.from("life_os_sync_devices").upsert({
    user_id: user.id,
    device_id: deviceId,
    device_name: String(body?.deviceName || "Perangkat Licia").slice(0, 120),
    platform: String(body?.platform || "web").slice(0, 40),
    app_version: String(body?.appVersion || "v31").slice(0, 40),
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,device_id" }).select("id,device_id,device_name,platform,app_version,last_seen_at,last_sync_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, device: data, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
