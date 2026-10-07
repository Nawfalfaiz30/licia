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
  const { data, error } = await supabase
    .from("life_os_sync_conflicts")
    .select(
      "id,device_id,mutation_id,entity_type,entity_id,strategy,client_version,server_version,client_payload,server_payload,conflicting_fields,status,resolution,created_at,resolved_at",
    )
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, conflicts: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
