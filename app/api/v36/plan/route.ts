import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const e = enforceSameOrigin(req);
  if (e) return e;
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data, error } = await s
    .from("ai_action_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, plans: data ?? [] });
}
export async function PATCH(req: Request) {
  const e = enforceSameOrigin(req);
  if (e) return e;
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || "");
  const mode = String(b?.mode || "");
  if (!id || !["cancelled", "expired"].includes(mode))
    return NextResponse.json({ error: "Perubahan status tidak valid." }, { status: 400 });
  const { data: plan } = await s
    .from("ai_action_plans")
    .select("result")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const now = new Date().toISOString();
  const { data, error } = await s
    .from("ai_action_plans")
    .update({ mode, updated_at: now })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pendingId = String((plan?.result as any)?.pendingActionId || "");
  if (pendingId)
    await s
      .from("ai_pending_actions")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("id", pendingId)
      .eq("user_id", user.id)
      .eq("status", "pending");
  return NextResponse.json({ ok: true, plan: data });
}
