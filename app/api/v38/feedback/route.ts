import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const insightKey = String(body?.insightKey || "").slice(0, 160);
  const useful = body?.useful === true ? true : body?.useful === false ? false : null;
  const category = typeof body?.category === "string" ? body.category.slice(0, 40) : null;
  const messageExcerpt = typeof body?.messageExcerpt === "string" ? body.messageExcerpt.slice(0, 500) : null;
  if (!insightKey || useful === null) return NextResponse.json({ error: "Feedback tidak valid." }, { status: 400 });
  const safeContext = body?.context && typeof body.context === "object" ? body.context : {};
  const note = JSON.stringify({ category, messageExcerpt, context: safeContext }).slice(0, 1200);
  let { error } = await supabase.from("ai_insight_feedback").upsert(
    {
      user_id: user.id,
      insight_key: insightKey,
      action: useful ? "useful" : "not_useful",
      note,
      feedback_category: category,
      message_excerpt: messageExcerpt,
      context: safeContext,
    },
    { onConflict: "user_id,insight_key" },
  );
  // Compatibility fallback: V38 migration is additive, so feedback still works on a V36/V37 DB.
  if (error) {
    const legacy = await supabase
      .from("ai_insight_feedback")
      .upsert(
        { user_id: user.id, insight_key: insightKey, action: useful ? "useful" : "not_useful", note },
        { onConflict: "user_id,insight_key" },
      );
    error = legacy.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
