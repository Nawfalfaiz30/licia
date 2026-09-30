import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const [{ data: devices, error: devicesError }, { count: openConflicts, error: conflictsError }, { count: pendingMutations, error: mutationsError }] = await Promise.all([
    supabase.from("life_os_sync_devices").select("id,device_id,device_name,platform,app_version,last_seen_at,last_sync_at,last_cursor,sync_status,last_error,created_at").eq("user_id", user.id).order("last_seen_at", { ascending: false }).limit(20),
    supabase.from("life_os_sync_conflicts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "open"),
    supabase.from("life_os_sync_mutations").select("mutation_id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "processing"),
  ]);

  if (devicesError || conflictsError || mutationsError) {
    return NextResponse.json({ error: devicesError?.message || conflictsError?.message || mutationsError?.message || "Status sinkronisasi gagal." }, { status: 500 });
  }

  const now = Date.now();
  const enriched = (devices || []).map((device) => ({
    ...device,
    online: device.last_seen_at ? now - new Date(device.last_seen_at).getTime() < 2 * 60_000 : false,
  }));

  return NextResponse.json({
    ok: true,
    devices: enriched,
    openConflicts: openConflicts || 0,
    pendingMutations: pendingMutations || 0,
    serverTime: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
