import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const checks = await Promise.all([
    supabase.from("life_os_sync_devices").select("id").eq("user_id", user.id).limit(1),
    supabase
      .from("life_os_sync_events")
      .select("sequence")
      .eq("user_id", user.id)
      .order("sequence", { ascending: false })
      .limit(1),
    supabase.from("ai_action_plans").select("id").eq("user_id", user.id).limit(1),
    supabase.from("ai_watchers").select("id").eq("user_id", user.id).limit(1),
    supabase.from("life_os_task_dependencies").select("id").eq("user_id", user.id).limit(1),
  ]);
  const labels = ["syncDevices", "syncEvents", "actionPlans", "watchers", "taskDependencies"];
  const details = Object.fromEntries(checks.map((r, i) => [labels[i], !r.error]));
  const score = Math.round((Object.values(details).filter(Boolean).length / Object.keys(details).length) * 100);
  return NextResponse.json(
    { ok: score >= 80, score, details, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
