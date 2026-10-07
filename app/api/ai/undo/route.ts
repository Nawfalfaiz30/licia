import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { undoActionGroup } from "@/lib/ai/actionUndo";

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`undo:${user.id}`, 20, 60_000);
  if (gate) return gate;
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.actionId === "string" ? body.actionId : "";
  if (!id) return NextResponse.json({ error: "ID aksi tidak valid." }, { status: 400 });

  const { data: seed, error: fetchError } = await supabase
    .from("ai_action_history")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !seed) return NextResponse.json({ error: "Riwayat aksi tidak ditemukan." }, { status: 404 });
  if (!seed.undoable || seed.undone_at)
    return NextResponse.json({ error: "Aksi ini sudah dibatalkan atau tidak dapat dipulihkan." }, { status: 409 });

  const undone = await undoActionGroup(supabase, user.id, seed);
  return NextResponse.json(
    {
      ok: undone.ok,
      actionId: seed.id,
      batchId: undone.batchId ?? seed.batch_id ?? null,
      label: undone.label ?? seed.label,
      results: undone.results ?? [],
      partial: Boolean(undone.partial),
      error: undone.ok ? undefined : (undone.error ?? undone.results?.find((item: any) => !item.ok)?.error),
    },
    { status: undone.ok ? 200 : 500 },
  );
}
