import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeBeforeForRestore } from "@/lib/ai/actionHistory";

async function restoreBoundReminders(supabase: any, userId: string, reminders: any[]) {
  for (const reminder of reminders ?? []) {
    const { id, ...payload } = reminder ?? {};
    if (!id) continue;
    const existing = await supabase
      .from("reminders")
      .select("id")
      .eq("id", String(id))
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.data?.id) {
      const result = await supabase.from("reminders").update(payload).eq("id", String(id)).eq("user_id", userId);
      if (result.error) return result.error;
    } else {
      const result = await supabase.from("reminders").insert({ id, ...payload, user_id: userId });
      if (result.error) return result.error;
    }
  }
  return null;
}

export async function undoActionRecord(supabase: SupabaseClient, userId: string, action: any) {
  const ids = Array.isArray(action?.record_ids) ? action.record_ids.map(String).filter(Boolean) : [];
  if (action?.operation === "create") {
    if (!ids.length) return { ok: false, error: "Snapshot pembuatan tidak memiliki ID." };
    const result = await supabase.from(action.table_name).delete().in("id", ids).eq("user_id", userId);
    return result.error ? { ok: false, error: result.error.message } : { ok: true };
  }

  if (action?.operation === "update") {
    const rows = Array.isArray(action.before_snapshot?.rows) ? action.before_snapshot.rows : null;
    if (rows) {
      if (!rows.length) return { ok: false, error: "Snapshot perubahan massal kosong." };
      for (const row of rows) {
        if (!row?.id) return { ok: false, error: "Snapshot perubahan massal memiliki row tanpa ID." };
        const restorePayload = sanitizeBeforeForRestore(action.table_name, { row }) as Record<string, any> | null;
        if (!restorePayload) return { ok: false, error: "Snapshot perubahan massal tidak dapat dipulihkan." };
        const restored = await supabase
          .from(action.table_name)
          .update(restorePayload)
          .eq("id", String(row.id))
          .eq("user_id", userId);
        if (restored.error) return { ok: false, error: restored.error.message };
      }
      if (action.table_name === "tasks" && Array.isArray(action.before_snapshot?.reminders)) {
        const reminderError = await restoreBoundReminders(supabase, userId, action.before_snapshot.reminders);
        if (reminderError) return { ok: false, error: reminderError.message };
      }
      return { ok: true };
    }
    const row = action.before_snapshot?.row ?? action.before_snapshot;
    if (!row?.id) return { ok: false, error: "Snapshot perubahan tidak lengkap." };
    const restorePayload = sanitizeBeforeForRestore(action.table_name, action.before_snapshot) as Record<
      string,
      any
    > | null;
    if (!restorePayload) return { ok: false, error: "Snapshot perubahan tidak dapat dipulihkan." };
    const restored = await supabase
      .from(action.table_name)
      .update(restorePayload)
      .eq("id", String(row.id))
      .eq("user_id", userId);
    return restored.error ? { ok: false, error: restored.error.message } : { ok: true };
  }

  if (action?.operation === "delete") {
    const rows = Array.isArray(action.before_snapshot?.rows) ? action.before_snapshot.rows : null;
    if (rows) {
      if (!rows.length) return { ok: false, error: "Snapshot pemulihan kosong." };
      const restored = await supabase.from(action.table_name).insert(rows);
      if (restored.error) return { ok: false, error: restored.error.message };
      if (
        action.table_name === "tasks" &&
        Array.isArray(action.before_snapshot?.subtasks) &&
        action.before_snapshot.subtasks.length
      ) {
        const subtasks = await supabase.from("subtasks").insert(action.before_snapshot.subtasks);
        if (subtasks.error) return { ok: false, error: subtasks.error.message };
      }
      if (Array.isArray(action.before_snapshot?.reminders)) {
        const reminderError = await restoreBoundReminders(supabase, userId, action.before_snapshot.reminders);
        if (reminderError) return { ok: false, error: reminderError.message };
      }
      return { ok: true };
    }
    const row = action.before_snapshot?.row ?? action.before_snapshot;
    if (!row?.id) return { ok: false, error: "Snapshot pemulihan tidak lengkap." };
    const restored = await supabase.from(action.table_name).insert(row);
    return restored.error ? { ok: false, error: restored.error.message } : { ok: true };
  }

  return { ok: false, error: "Jenis undo tidak didukung." };
}

async function verifyRestoredAction(supabase: SupabaseClient, userId: string, action: any) {
  const ids = Array.isArray(action?.record_ids) ? action.record_ids.map(String).filter(Boolean) : [];
  if (!ids.length) return { ok: false, error: "Aksi tidak memiliki record ID untuk diverifikasi." };
  const { data, error } = await supabase.from(action.table_name).select("*").eq("user_id", userId).in("id", ids);
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  if (action.operation === "create") {
    return rows.length === 0
      ? { ok: true }
      : { ok: false, error: "Rollback pembuatan belum terverifikasi karena record masih ada." };
  }
  if (rows.length !== ids.length)
    return { ok: false, error: "Rollback belum lengkap: sebagian record target tidak ditemukan setelah pemulihan." };
  if (action.operation === "delete") return { ok: true };
  if (action.operation === "update") {
    const expectedRows: Array<Record<string, any>> = Array.isArray(action.before_snapshot?.rows)
      ? (action.before_snapshot.rows as Array<Record<string, any>>)
      : action.before_snapshot?.row
        ? [action.before_snapshot.row as Record<string, any>]
        : [];
    const actualRows = rows as Array<Record<string, any>>;
    const expectedById = new Map<string, Record<string, any>>(expectedRows.map((row) => [String(row.id), row]));
    if (action.table_name === "tasks") {
      for (const row of actualRows) {
        const expected = expectedById.get(String(row.id));
        if (!expected) continue;
        if (expected.status !== undefined && String(row.status) !== String(expected.status))
          return { ok: false, error: "Status task belum kembali ke nilai semula." };
        if (expected.priority !== undefined && String(row.priority ?? "") !== String(expected.priority ?? ""))
          return { ok: false, error: "Prioritas task belum kembali ke nilai semula." };
        const expectedDue = expected.due_at == null ? null : new Date(String(expected.due_at)).getTime();
        const actualDue = row.due_at == null ? null : new Date(String(row.due_at)).getTime();
        if (expectedDue !== actualDue) return { ok: false, error: "Deadline task belum kembali ke nilai semula." };
      }
    }
    return { ok: true };
  }
  return { ok: false, error: "Jenis undo tidak didukung untuk verifikasi." };
}

export async function undoActionGroup(supabase: SupabaseClient, userId: string, seed: any) {
  if (!seed?.id) return { ok: false, error: "Riwayat aksi tidak ditemukan." };
  if (!seed.undoable || seed.undone_at)
    return { ok: false, error: "Aksi ini sudah dibatalkan atau tidak dapat dipulihkan." };
  let actions = [seed];
  if (seed.batch_id) {
    const { data: batch } = await supabase
      .from("ai_action_history")
      .select("*")
      .eq("user_id", userId)
      .eq("batch_id", seed.batch_id)
      .is("undone_at", null)
      .order("created_at", { ascending: false });
    if (batch?.length) actions = batch;
  }
  const results: Array<{ id: string; ok: boolean; label: string; error?: string }> = [];
  for (const action of actions) {
    const result = await undoActionRecord(supabase, userId, action);
    if (!result.ok) {
      results.push({
        id: String(action.id),
        ok: false,
        label: String(action.label || action.tool_name || "Perubahan"),
        error: result.error,
      });
      break;
    }
    const verified = await verifyRestoredAction(supabase, userId, action);
    if (!verified.ok) {
      results.push({
        id: String(action.id),
        ok: false,
        label: String(action.label || action.tool_name || "Perubahan"),
        error: verified.error,
      });
      break;
    }
    results.push({ id: String(action.id), ok: true, label: String(action.label || action.tool_name || "Perubahan") });
    const mark = await supabase
      .from("ai_action_history")
      .update({ undone_at: new Date().toISOString() })
      .eq("id", action.id)
      .eq("user_id", userId)
      .is("undone_at", null);
    if (mark.error) {
      results[results.length - 1].ok = false;
      results[results.length - 1].error = mark.error.message;
      break;
    }
  }
  const failed = results.some((item) => !item.ok);
  return {
    ok: !failed,
    seedId: String(seed.id),
    batchId: seed.batch_id ?? null,
    label: String(seed.label || "Perubahan"),
    results,
    partial: failed && results.some((item) => item.ok),
  };
}

export async function loadLatestUndoableAction(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("ai_action_history")
    .select("*")
    .eq("user_id", userId)
    .eq("undoable", true)
    .is("undone_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { action: null, error: error.message };
  return { action: data ?? null, error: null };
}
