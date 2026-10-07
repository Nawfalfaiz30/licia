import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const e = enforceSameOrigin(req);
  if (e) return e;
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const key = String(b?.insightKey || "").slice(0, 160);
  const useful = b?.useful === true ? true : b?.useful === false ? false : null;
  if (!key || useful === null) return NextResponse.json({ error: "Feedback tidak valid." }, { status: 400 });
  const { error } = await s
    .from("ai_insight_feedback")
    .upsert(
      {
        user_id: user.id,
        insight_key: key,
        action: useful ? "useful" : "not_useful",
        note: typeof b?.comment === "string" ? b.comment.slice(0, 500) : JSON.stringify(b?.context || {}).slice(0, 500),
      },
      { onConflict: "user_id,insight_key" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
