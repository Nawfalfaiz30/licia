import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeTool } from "@/lib/ai/tools";
import { captureBeforeAction, buildUndoRecord } from "@/lib/ai/actionHistory";
import { verifyMutationResult } from "@/lib/v35/verify";
import { distributedRateLimit, enforceSameOrigin } from "@/lib/security";

function mutationApplied(tool: string, result: any) {
  if (!result?.ok) return false;
  const status = String(result?.status || "").toLowerCase();
  if (
    [
      "single_candidate_needs_confirmation",
      "multiple_candidates",
      "confirmation_required",
      "preview",
      "no_match",
      "no_changes",
    ].includes(status)
  )
    return false;
  if (result?.requires_confirmation === true) return false;
  if (tool === "delete_schedule_blocks_bulk" || tool === "delete_tasks_bulk") return Number(result?.count || 0) > 0;
  if (tool === "delete_all_notifications") return Number(result?.deleted || 0) > 0;
  if (tool.startsWith("delete_"))
    return Boolean(result?.deleted || result?.archived || Number(result?.deleted_count || 0) > 0);
  if (tool === "create_daily_schedule") return Number(result?.created || 0) > 0;
  return true;
}

function actionLabel(tool: string) {
  const map: Record<string, string> = {
    create_task_with_subtasks: "Membuat tugas",
    update_task: "Memperbarui tugas",
    delete_task: "Menghapus tugas",
    delete_tasks_bulk: "Menghapus banyak tugas",
    create_project: "Membuat proyek",
    update_project: "Memperbarui proyek",
    delete_project: "Menghapus proyek",
    create_goal: "Membuat target",
    update_goal: "Memperbarui target",
    delete_goal: "Menghapus target",
    log_expense: "Mencatat pengeluaran",
    update_expense: "Memperbarui pengeluaran",
    delete_expense: "Menghapus pengeluaran",
    log_income: "Mencatat pemasukan",
    update_income: "Memperbarui pemasukan",
    delete_income: "Menghapus pemasukan",
    create_daily_schedule: "Membuat agenda",
    update_schedule_block: "Memperbarui agenda",
    delete_schedule_block: "Menghapus agenda",
    delete_schedule_blocks_bulk: "Menghapus banyak agenda",
    delete_all_reminders: "Menghapus semua pengingat",
    capture_inbox_item: "Menambahkan ke Inbox",
    create_note: "Membuat catatan",
    update_note: "Memperbarui catatan",
    delete_note: "Menghapus catatan",
    save_memory: "Menyimpan memory",
    delete_memory: "Menghapus memory",
    create_vault_item: "Membuat item Vault",
    update_vault_item: "Memperbarui Vault",
    delete_vault_item: "Menghapus item Vault",
    create_automation: "Membuat otomasi",
    update_automation: "Memperbarui otomasi",
    delete_automation: "Menghapus otomasi",
    create_habit: "Membuat rutinitas",
    update_habit: "Memperbarui rutinitas",
    delete_habit: "Menghapus rutinitas",
    checkin_habit: "Check-in rutinitas",
    create_subscription: "Membuat langganan",
    update_subscription: "Memperbarui langganan",
    delete_subscription: "Menghapus langganan",
    create_budget: "Membuat anggaran",
    update_budget: "Memperbarui anggaran",
    delete_budget: "Menghapus anggaran",
    create_account: "Membuat dompet",
    update_account: "Memperbarui dompet",
    delete_account: "Menghapus dompet",
    log_pomodoro_session: "Mencatat sesi fokus",
    delete_pomodoro_session: "Menghapus sesi fokus",
    log_decision: "Mencatat keputusan",
    update_decision: "Memperbarui keputusan",
    delete_decision: "Menghapus keputusan",
    create_skill: "Membuat skill",
    update_skill: "Memperbarui skill",
    delete_skill: "Menghapus skill",
    delete_reading: "Menghapus bacaan",
    log_reading: "Mencatat bacaan",
    get_notifications: "Membaca riwayat notifikasi",
    delete_notification: "Menghapus notifikasi",
    delete_all_notifications: "Menghapus semua riwayat notifikasi",
    mark_notification_read: "Menandai notifikasi terbaca",
  };
  return map[tool] || "Menjalankan aksi";
}

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = await distributedRateLimit(supabase, "ai-batch", 5, 60_000, `ai-batch:${user.id}`, {
    failClosed: true,
  });
  if (gate) return gate;
  const body = await req.json().catch(() => ({}));
  const pendingId = typeof body?.pendingId === "string" ? body.pendingId : "";
  if (!pendingId) return NextResponse.json({ error: "Aksi tertunda tidak valid." }, { status: 400 });

  const { data: pending, error: pendingError } = await supabase
    .from("ai_pending_actions")
    .select("*")
    .eq("id", pendingId)
    .eq("user_id", user.id)
    .single();
  if (pendingError || !pending) return NextResponse.json({ error: "Rencana aksi tidak ditemukan." }, { status: 404 });
  if (pending.status !== "pending")
    return NextResponse.json({ error: "Rencana aksi sudah diproses atau dibatalkan." }, { status: 409 });
  if (new Date(pending.expires_at).getTime() < Date.now())
    return NextResponse.json({ error: "Rencana aksi sudah kedaluwarsa." }, { status: 410 });

  const actions = Array.isArray(pending.actions) ? pending.actions.slice(0, 10) : [];
  if (!actions.length) return NextResponse.json({ error: "Tidak ada aksi yang bisa dijalankan." }, { status: 400 });

  const batchId = pendingId;
  const performed: Array<{ tool: string; ok: boolean; label: string; error?: string; code?: string; status?: string }> =
    [];
  const undoIds: string[] = [];
  for (const action of actions) {
    const tool = typeof action?.tool === "string" ? action.tool : "";
    let args = typeof action?.arguments === "string" ? action.arguments : JSON.stringify(action?.arguments ?? {});
    if (!tool) continue;
    let parsed: any = {};
    try {
      parsed = JSON.parse(args || "{}");
    } catch {}
    if (tool === "delete_schedule_blocks_bulk") {
      parsed.confirm_all = true;
      args = JSON.stringify(parsed);
    }
    const before = await captureBeforeAction(supabase, user.id, tool, parsed);
    let result: any;
    try {
      result = await executeTool(
        { supabase, userId: user.id, timezone: String(pending.timezone || "Asia/Jakarta") },
        tool,
        args,
      );
      if (result?.ok) result = await verifyMutationResult(supabase, user.id, tool, result);
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : "Aksi gagal karena kesalahan sistem." };
    }
    const label = actionLabel(tool);
    const applied = mutationApplied(tool, result);
    const semanticError =
      !applied && result?.status === "single_candidate_needs_confirmation"
        ? "Target belum dikonfirmasi untuk dihapus."
        : !applied && result?.status === "multiple_candidates"
          ? "Ada beberapa kandidat; target belum dikonfirmasi."
          : !applied && result?.status === "confirmation_required"
            ? String(result?.message || "Konfirmasi eksplisit masih diperlukan.")
            : !applied && result?.status === "no_changes"
              ? String(result?.message || "Tidak ada perubahan yang dilakukan.")
              : undefined;
    performed.push({
      tool,
      ok: applied,
      label,
      ...(result?.error ? { error: String(result.error) } : semanticError ? { error: semanticError } : {}),
      ...(result?.code ? { code: String(result.code) } : {}),
      ...(result?.status ? { status: String(result.status) } : {}),
    });
    if (applied) {
      const undo = buildUndoRecord(tool, result, before);
      if (undo?.undoable && undo.record_ids?.length) {
        const saved = await supabase
          .from("ai_action_history")
          .insert({
            user_id: user.id,
            batch_id: batchId,
            tool_name: tool,
            label,
            operation: undo.operation,
            table_name: undo.table_name,
            record_ids: undo.record_ids,
            before_snapshot: undo.before_snapshot,
            after_snapshot: undo.after_snapshot,
            undoable: true,
          })
          .select("id")
          .single();
        if (!saved.error && saved.data?.id) undoIds.push(saved.data.id);
      }
    }
    await supabase.from("ai_function_call_logs").insert({
      user_id: user.id,
      raw_user_text: String(pending.user_text || ""),
      function_name: tool,
      arguments: args,
      status: result?.ok ? "success" : "error",
    });
  }

  const failedItems = performed.filter((x) => !x.ok);
  const failed = failedItems.length;
  const completed = performed.length - failed;
  const finishedAt = new Date().toISOString();
  const executionResult = {
    status: failed ? (completed ? "partial" : "failed") : "completed",
    completed,
    failed,
    actions: performed,
    failed_details: failedItems.map((x) => ({
      tool: x.tool,
      label: x.label,
      error: x.error || "Tidak ada detail error dari tool.",
    })),
    finished_at: finishedAt,
  };

  // Jangan mengunci batch sebagai "applied" bila semua aksi gagal.
  // Pending tetap tersedia sehingga pengguna bisa memperbaiki penyebabnya lalu
  // mencoba lagi. Bila sebagian berhasil, batch ditutup dengan applied_with_errors.
  if (completed === 0 && failed > 0) {
    const detail = failedItems
      .map((x, index) => `${index + 1}. ${x.label}: ${x.error || "Aksi gagal tanpa detail error."}`)
      .join("\n");
    return NextResponse.json(
      {
        ok: false,
        actions: performed,
        undoActionId: undoIds.at(-1) || null,
        undoActionIds: undoIds,
        partial: false,
        failed: true,
        pending: true,
        executionResult,
        error: `Tidak ada perubahan yang berhasil diterapkan.\n${detail}`,
      },
      { status: 422 },
    );
  }

  const desiredStatus = failed > 0 ? "applied_with_errors" : "applied";
  const pendingBaseFilter = (query: any) => query.eq("id", pendingId).eq("user_id", user.id).eq("status", "pending");
  let coreMark = await pendingBaseFilter(
    supabase.from("ai_pending_actions").update({ status: desiredStatus, applied_at: finishedAt }),
  );

  if (coreMark.error && desiredStatus === "applied_with_errors") {
    // Fallback untuk database lama yang belum mengenal status partial.
    coreMark = await pendingBaseFilter(
      supabase.from("ai_pending_actions").update({ status: "applied", applied_at: finishedAt }),
    );
  }

  if (coreMark.error) {
    const coreText = JSON.stringify(coreMark.error).toLowerCase();
    const legacyTransitionError =
      /invalid ai_pending_actions status transition/.test(coreText) ||
      (/ai_pending_actions/.test(coreText) && /status transition/.test(coreText));
    if (legacyTransitionError) {
      return NextResponse.json(
        {
          ok: false,
          requiresMigration: true,
          alreadyExecuted: performed.length > 0,
          actions: performed,
          undoActionId: undoIds.at(-1) || null,
          undoActionIds: undoIds,
          error:
            "Database masih memakai trigger ai_pending_actions lama. Jalankan migration V35.1.1 sebelum menerapkan batch ini.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: coreMark.error.message }, { status: 500 });
  }

  let metadataPersisted = true;
  const metadataResult = await supabase
    .from("ai_pending_actions")
    .update({
      completed_actions: completed,
      failed_actions: failed,
      error_summary: failed
        ? failedItems
            .map((x) => `${x.label}: ${x.error || "gagal"}`)
            .join("; ")
            .slice(0, 2000)
        : null,
      execution_result: executionResult,
      updated_at: finishedAt,
    })
    .eq("id", pendingId)
    .eq("user_id", user.id);

  const latestPlans = await supabase
    .from("ai_action_plans")
    .select("id,result")
    .eq("user_id", user.id)
    .eq("mode", "preview")
    .order("created_at", { ascending: false })
    .limit(12);
  const matchedPlan = (latestPlans.data || []).find(
    (plan: any) => String(plan?.result?.pendingActionId || "") === pendingId,
  );
  if (matchedPlan?.id) {
    await supabase
      .from("ai_action_plans")
      .update({
        mode: desiredStatus === "applied" ? "committed" : "committed",
        applied_at: finishedAt,
        updated_at: finishedAt,
      })
      .eq("id", matchedPlan.id)
      .eq("user_id", user.id);
  }

  if (metadataResult.error) {
    const metaText = JSON.stringify(metadataResult.error).toLowerCase();
    const optionalColumnMissing =
      /ai_pending_actions/.test(metaText) &&
      /schema cache|column .*does not exist|could not find/.test(metaText) &&
      /(completed_actions|failed_actions|error_summary|execution_result)/.test(metaText);
    metadataPersisted = false;
    if (optionalColumnMissing) {
      console.warn(
        "[ai/batch] Optional execution metadata belum tersedia di schema/PostgREST cache; core batch state tetap tersimpan.",
      );
    } else {
      console.warn("[ai/batch] Gagal menyimpan metadata eksekusi:", metadataResult.error.message);
    }
  }
  return NextResponse.json({
    ok: true,
    actions: performed,
    undoActionId: undoIds.at(-1) || null,
    undoActionIds: undoIds,
    partial: failed > 0,
    executionResult,
    metadataPersisted,
  });
}

export async function DELETE(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const pendingId = typeof body?.pendingId === "string" ? body.pendingId : "";
  if (!pendingId) return NextResponse.json({ error: "Aksi tertunda tidak valid." }, { status: 400 });
  const cancelledAt = new Date().toISOString();
  const { error } = await supabase
    .from("ai_pending_actions")
    .update({ status: "cancelled", cancelled_at: cancelledAt })
    .eq("id", pendingId)
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const latestPlans = await supabase
    .from("ai_action_plans")
    .select("id,result")
    .eq("user_id", user.id)
    .eq("mode", "preview")
    .order("created_at", { ascending: false })
    .limit(12);
  const matchedPlan = (latestPlans.data || []).find(
    (plan: any) => String(plan?.result?.pendingActionId || "") === pendingId,
  );
  if (matchedPlan?.id)
    await supabase
      .from("ai_action_plans")
      .update({ mode: "cancelled", updated_at: cancelledAt })
      .eq("id", matchedPlan.id)
      .eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
