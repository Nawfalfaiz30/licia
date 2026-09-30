import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { sanitizeBeforeForRestore } from "@/lib/ai/actionHistory";

async function restoreBoundReminders(supabase: any, userId: string, reminders: any[]) {
  for (const reminder of reminders ?? []) {
    const { id, ...payload } = reminder;
    if (!id) continue;
    const existing = await supabase.from("reminders").select("id").eq("id", String(id)).eq("user_id", userId).maybeSingle();
    if (existing.data?.id) {
      await supabase.from("reminders").update(payload).eq("id", String(id)).eq("user_id", userId);
    } else {
      await supabase.from("reminders").insert({ id, ...payload, user_id: userId });
    }
  }
}

async function undoOne(supabase: any, userId: string, action: any) {
  const ids = Array.isArray(action.record_ids) ? action.record_ids.map(String) : [];
  let error: any = null;
  if (action.operation === "create") {
    if (!ids.length) return { ok: false, error: "Snapshot pembuatan tidak memiliki ID." };
    const res = await supabase.from(action.table_name).delete().in("id", ids).eq("user_id", userId);
    error = res.error;
  } else if (action.operation === "update") {
    const row = action.before_snapshot?.row ?? action.before_snapshot;
    if (!row?.id) return { ok: false, error: "Snapshot perubahan tidak lengkap." };
    const restored = await supabase.from(action.table_name).update(sanitizeBeforeForRestore(action.table_name, action.before_snapshot)).eq("id", String(row.id)).eq("user_id", userId);
    error = restored.error;
  } else if (action.operation === "delete") {
    const rows = Array.isArray(action.before_snapshot?.rows) ? action.before_snapshot.rows : null;
    if (rows) {
      if (!rows.length) return { ok: false, error: "Snapshot pemulihan kosong." };
      const restored = await supabase.from(action.table_name).insert(rows);
      error = restored.error;
      if (!error && action.table_name === "tasks" && Array.isArray(action.before_snapshot?.subtasks) && action.before_snapshot.subtasks.length) {
        const subtasks = await supabase.from("subtasks").insert(action.before_snapshot.subtasks);
        error = subtasks.error;
      }
      if (!error && Array.isArray(action.before_snapshot?.reminders) && action.before_snapshot.reminders.length) await restoreBoundReminders(supabase, userId, action.before_snapshot.reminders);
      if (!error && Array.isArray(action.before_snapshot?.reminders) && action.before_snapshot.reminders.length) await restoreBoundReminders(supabase, userId, action.before_snapshot.reminders);
    } else {
      const row = action.before_snapshot?.row ?? action.before_snapshot;
      if (!row?.id) return { ok: false, error: "Snapshot pemulihan tidak lengkap." };
      const restored = await supabase.from(action.table_name).insert(row);
      error = restored.error;
      if (!error && action.table_name === "tasks" && Array.isArray(action.before_snapshot?.subtasks) && action.before_snapshot.subtasks.length) {
        const subtasks = await supabase.from("subtasks").insert(action.before_snapshot.subtasks);
        error = subtasks.error;
      }
    }
  } else return { ok: false, error: "Jenis undo tidak didukung." };
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`undo:${user.id}`, 20, 60_000); if (gate) return gate;
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.actionId === "string" ? body.actionId : "";
  if (!id) return NextResponse.json({ error: "ID aksi tidak valid." }, { status: 400 });

  const { data: seed, error: fetchError } = await supabase.from("ai_action_history").select("*").eq("id", id).eq("user_id", user.id).single();
  if (fetchError || !seed) return NextResponse.json({ error: "Riwayat aksi tidak ditemukan." }, { status: 404 });
  if (!seed.undoable || seed.undone_at) return NextResponse.json({ error: "Aksi ini sudah dibatalkan atau tidak dapat dipulihkan." }, { status: 409 });

  let actions = [seed];
  if (seed.batch_id) {
    const { data: batch } = await supabase.from("ai_action_history").select("*").eq("user_id", user.id).eq("batch_id", seed.batch_id).is("undone_at", null).order("created_at", { ascending: false });
    if (batch?.length) actions = batch;
  }

  const results: Array<{ id:string; ok:boolean; label:string; error?:string }> = [];
  for (const action of actions) {
    const result = await undoOne(supabase, user.id, action);
    results.push({ id: action.id, ok: result.ok, label: action.label, ...(result.ok ? {} : { error: result.error }) });
    if (!result.ok) break;
    const { error: markError } = await supabase.from("ai_action_history").update({ undone_at: new Date().toISOString() }).eq("id", action.id).eq("user_id", user.id);
    if (markError) { results[results.length - 1].ok = false; results[results.length - 1].error = markError.message; break; }
  }
  const failed = results.some((x) => !x.ok);
  return NextResponse.json({ ok: !failed, actionId: seed.id, batchId: seed.batch_id ?? null, label: seed.label, results, partial: failed && results.some((x) => x.ok) }, { status: failed ? 500 : 200 });
}
