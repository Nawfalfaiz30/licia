import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";

export async function DELETE(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`ai-history-delete:${user.id}`, 12, 60_000);
  if (gate) return gate;

  let body: { id?: string; all?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id && body.all !== true)
    return NextResponse.json({ error: "Tentukan aksi atau gunakan all=true." }, { status: 400 });

  let query = supabase.from("ai_action_history").delete().eq("user_id", user.id);
  if (id) query = query.eq("id", id);
  const { data, error } = await query.select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, deleted: data?.length ?? 0 });
}
