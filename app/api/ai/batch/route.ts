import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeTool } from "@/lib/ai/tools";
import { captureBeforeAction, buildUndoRecord } from "@/lib/ai/actionHistory";
import { enforceSameOrigin, rateLimit } from "@/lib/security";

function actionLabel(tool: string) {
  const map: Record<string,string> = {
    create_task_with_subtasks:"Membuat tugas", update_task:"Memperbarui tugas", delete_task:"Menghapus tugas", delete_tasks_bulk:"Menghapus banyak tugas",
    create_project:"Membuat proyek", update_project:"Memperbarui proyek", delete_project:"Menghapus proyek",
    create_goal:"Membuat target", update_goal:"Memperbarui target", delete_goal:"Menghapus target",
    log_expense:"Mencatat pengeluaran", update_expense:"Memperbarui pengeluaran", delete_expense:"Menghapus pengeluaran",
    log_income:"Mencatat pemasukan", update_income:"Memperbarui pemasukan", delete_income:"Menghapus pemasukan",
    create_daily_schedule:"Membuat agenda", update_schedule_block:"Memperbarui agenda", delete_schedule_block:"Menghapus agenda",
    capture_inbox_item:"Menambahkan ke Inbox", create_note:"Membuat catatan", update_note:"Memperbarui catatan", delete_note:"Menghapus catatan",
    save_memory:"Menyimpan memory", delete_memory:"Menghapus memory", create_vault_item:"Membuat item Vault", update_vault_item:"Memperbarui Vault", delete_vault_item:"Menghapus item Vault",
    create_automation:"Membuat otomasi", update_automation:"Memperbarui otomasi", delete_automation:"Menghapus otomasi",
    create_habit:"Membuat rutinitas", update_habit:"Memperbarui rutinitas", delete_habit:"Menghapus rutinitas", checkin_habit:"Check-in rutinitas",
    create_subscription:"Membuat langganan", update_subscription:"Memperbarui langganan", delete_subscription:"Menghapus langganan",
    create_budget:"Membuat anggaran", update_budget:"Memperbarui anggaran", delete_budget:"Menghapus anggaran",
    create_account:"Membuat dompet", update_account:"Memperbarui dompet", delete_account:"Menghapus dompet",
    log_pomodoro_session:"Mencatat sesi fokus", delete_pomodoro_session:"Menghapus sesi fokus",
    log_decision:"Mencatat keputusan", update_decision:"Memperbarui keputusan", delete_decision:"Menghapus keputusan", create_skill:"Membuat skill", update_skill:"Memperbarui skill", delete_skill:"Menghapus skill", delete_reading:"Menghapus bacaan", log_reading:"Mencatat bacaan",
  };
  return map[tool] || "Menjalankan aksi";
}

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`ai-batch:${user.id}`, 8, 60_000); if (gate) return gate;
  const body = await req.json().catch(() => ({}));
  const pendingId = typeof body?.pendingId === "string" ? body.pendingId : "";
  if (!pendingId) return NextResponse.json({ error: "Aksi tertunda tidak valid." }, { status: 400 });

  const { data: pending, error: pendingError } = await supabase.from("ai_pending_actions").select("*").eq("id", pendingId).eq("user_id", user.id).single();
  if (pendingError || !pending) return NextResponse.json({ error: "Rencana aksi tidak ditemukan." }, { status: 404 });
  if (pending.status !== "pending") return NextResponse.json({ error: "Rencana aksi sudah diproses atau dibatalkan." }, { status: 409 });
  if (new Date(pending.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Rencana aksi sudah kedaluwarsa." }, { status: 410 });

  const actions = Array.isArray(pending.actions) ? pending.actions.slice(0, 10) : [];
  if (!actions.length) return NextResponse.json({ error: "Tidak ada aksi yang bisa dijalankan." }, { status: 400 });

  const batchId = pendingId;
  const performed: Array<{ tool:string; ok:boolean; label:string }> = [];
  const undoIds: string[] = [];
  for (const action of actions) {
    const tool = typeof action?.tool === "string" ? action.tool : "";
    const args = typeof action?.arguments === "string" ? action.arguments : JSON.stringify(action?.arguments ?? {});
    if (!tool) continue;
    let parsed: any = {}; try { parsed = JSON.parse(args || "{}"); } catch {}
    const before = await captureBeforeAction(supabase, user.id, tool, parsed);
    let result: any;
    try { result = await executeTool({ supabase, userId: user.id, timezone: String(pending.timezone || "Asia/Jakarta") }, tool, args); }
    catch { result = { ok: false, error: "Aksi gagal karena kesalahan sistem." }; }
    const label = actionLabel(tool);
    performed.push({ tool, ok: Boolean(result?.ok), label });
    if (result?.ok) {
      const undo = buildUndoRecord(tool, result, before);
      if (undo?.undoable && undo.record_ids?.length) {
        const saved = await supabase.from("ai_action_history").insert({
          user_id: user.id, batch_id: batchId, tool_name: tool, label, operation: undo.operation, table_name: undo.table_name,
          record_ids: undo.record_ids, before_snapshot: undo.before_snapshot, after_snapshot: undo.after_snapshot, undoable: true,
        }).select("id").single();
        if (!saved.error && saved.data?.id) undoIds.push(saved.data.id);
      }
    }
    await supabase.from("ai_function_call_logs").insert({ user_id: user.id, raw_user_text: String(pending.user_text || ""), function_name: tool, arguments: args, status: result?.ok ? "success" : "error" });
  }

  const failed = performed.filter(x => !x.ok).length;
  const { error: markError } = await supabase.from("ai_pending_actions").update({ status: failed ? "applied_with_errors" : "applied", applied_at: new Date().toISOString() }).eq("id", pendingId).eq("user_id", user.id);
  if (markError) return NextResponse.json({ error: markError.message }, { status: 500 });
  return NextResponse.json({ ok: true, actions: performed, undoActionId: undoIds.at(-1) || null, undoActionIds: undoIds, partial: failed > 0 });
}

export async function DELETE(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const pendingId = typeof body?.pendingId === "string" ? body.pendingId : "";
  if (!pendingId) return NextResponse.json({ error: "Aksi tertunda tidak valid." }, { status: 400 });
  const { error } = await supabase.from("ai_pending_actions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", pendingId).eq("user_id", user.id).eq("status", "pending");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
