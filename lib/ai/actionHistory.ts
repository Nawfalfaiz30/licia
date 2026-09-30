import type { SupabaseClient } from "@supabase/supabase-js";

const DELETE_IDS: Record<string, { table: string; field: string }> = {
  delete_expense: { table: "expenses", field: "confirm_expense_id" },
  delete_task: { table: "tasks", field: "confirm_task_id" },
  delete_pomodoro_session: { table: "pomodoro_sessions", field: "confirm_session_id" },
  delete_schedule_block: { table: "schedule_blocks", field: "confirm_block_id" },
  delete_income: { table: "incomes", field: "confirm_income_id" },
  delete_budget: { table: "budgets", field: "confirm_budget_id" },
  delete_health_log: { table: "", field: "confirm_log_id" },
  delete_account: { table: "accounts", field: "confirm_account_id" },
  delete_goal: { table: "goals", field: "confirm_goal_id" },
  delete_note: { table: "brain_dump_notes", field: "confirm_note_id" },
  delete_reading: { table: "reading_logs", field: "confirm_reading_id" },
  delete_project: { table: "projects", field: "confirm_project_id" },
  delete_memory: { table: "user_memories", field: "confirm_memory_id" },
  delete_habit: { table: "habits", field: "confirm_habit_id" },
  delete_subscription: { table: "subscriptions", field: "confirm_subscription_id" },
  delete_vault_item: { table: "vault_items", field: "confirm_vault_id" },
  delete_automation: { table: "automations", field: "confirm_automation_id" },
  delete_decision: { table: "decisions", field: "confirm_decision_id" },
  delete_skill: { table: "skills", field: "confirm_skill_id" },
  delete_reminder: { table: "reminders", field: "confirm_reminder_id" },
  delete_subtask: { table: "subtasks", field: "subtask_id" },
};

const UPDATE_META: Record<string, { table: string; field: string }> = {
  update_expense: { table: "expenses", field: "expense_id" },
  update_task: { table: "tasks", field: "task_id" },
  update_income: { table: "incomes", field: "income_id" },
  update_goal: { table: "goals", field: "goal_id" },
  update_note: { table: "brain_dump_notes", field: "note_id" },
  update_reading: { table: "reading_logs", field: "reading_id" },
  update_project: { table: "projects", field: "project_id" },
  update_account: { table: "accounts", field: "account_id" },
  update_budget: { table: "budgets", field: "budget_id" },
  update_subscription: { table: "subscriptions", field: "subscription_id" },
  update_vault_item: { table: "vault_items", field: "item_id" },
  update_automation: { table: "automations", field: "automation_id" },
  update_habit: { table: "habits", field: "habit_id" },
  update_decision: { table: "decisions", field: "decision_id" },
  update_skill: { table: "skills", field: "skill_id" },
  update_schedule_block: { table: "schedule_blocks", field: "block_id" },
  update_reminder: { table: "reminders", field: "reminder_id" },
};

const CREATE_META: Record<string, { table: string; resultKey: string }> = {
  log_expense: { table: "expenses", resultKey: "expense" },
  log_income: { table: "incomes", resultKey: "income" },
  create_task_with_subtasks: { table: "tasks", resultKey: "task" },
  create_task_from_inbox: { table: "tasks", resultKey: "task" },
  create_task_from_note: { table: "tasks", resultKey: "task" },
  create_task_from_project: { table: "tasks", resultKey: "task" },
  create_task_from_goal: { table: "tasks", resultKey: "task" },
  create_schedule_from_task: { table: "schedule_blocks", resultKey: "block" },
  create_schedule_reminder: { table: "reminders", resultKey: "reminder" },
  create_reminder: { table: "reminders", resultKey: "reminder" },
  create_daily_schedule: { table: "schedule_blocks", resultKey: "blocks" },
  capture_inbox_item: { table: "smart_inbox_items", resultKey: "item" },
  log_decision: { table: "decisions", resultKey: "decision" },
  create_skill: { table: "skills", resultKey: "skill" },
  create_budget: { table: "budgets", resultKey: "budget" },
  create_account: { table: "accounts", resultKey: "account" },
  create_goal: { table: "goals", resultKey: "goal" },
  create_note: { table: "brain_dump_notes", resultKey: "note" },
  log_reading: { table: "reading_logs", resultKey: "reading" },
  create_project: { table: "projects", resultKey: "project" },
  create_vault_item: { table: "vault_items", resultKey: "item" },
  create_automation: { table: "automations", resultKey: "rule" },
  create_habit: { table: "habits", resultKey: "habit" },
  create_subscription: { table: "subscriptions", resultKey: "subscription" },
};

function stripForUpdate(row: Record<string, any>) {
  const copy = { ...row };
  delete copy.id;
  delete copy.user_id;
  delete copy.created_at;
  return copy;
}

export async function captureBeforeAction(supabase: SupabaseClient, userId: string, toolName: string, args: any) {
  if (toolName === "update_task" && args?.subtask_id) {
    const { data, error } = await supabase.from("subtasks").select("*").eq("id", String(args.subtask_id)).eq("user_id", userId).maybeSingle();
    return error || !data ? null : { row: data, table: "subtasks" };
  }
  const update = UPDATE_META[toolName];
  if (toolName === "delete_health_log" && args?.kind && args?.confirm_log_id) {
    const healthTables: Record<string, string> = { hydration: "hydration_logs", caffeine: "caffeine_logs", meal: "meal_logs", medication: "medication_logs", energy: "fatigue_logs" };
    const table = healthTables[String(args.kind)];
    if (table) {
      const { data, error } = await supabase.from(table).select("*").eq("id", String(args.confirm_log_id)).eq("user_id", userId).maybeSingle();
      return error || !data ? null : { row: data, table };
    }
  }
  if (toolName === "delete_tasks_bulk") {
    let query = supabase.from("tasks").select("*").eq("user_id", userId);
    const status = typeof args?.status === "string" ? args.status : "all";
    if (["todo", "in_progress", "done"].includes(status)) query = query.eq("status", status);
    if (typeof args?.keyword === "string" && args.keyword.trim()) query = query.ilike("title", `%${args.keyword.trim()}%`);
    const { data: rows, error } = await query.order("created_at", { ascending: false });
    if (error || !rows?.length) return error ? null : { rows: [], subtasks: [] };
    const ids = rows.map((row:any)=>String(row.id));
    const [{ data: subtasks }, { data: reminders }] = await Promise.all([
      supabase.from("subtasks").select("*").in("task_id", ids).eq("user_id", userId),
      supabase.from("reminders").select("*").eq("user_id", userId).eq("target_type", "task").in("target_id", ids),
    ]);
    return { rows, subtasks: subtasks ?? [], reminders: reminders ?? [] };
  }
  const deletion = DELETE_IDS[toolName];
  const meta = update || deletion;
  if (!meta?.table || !args?.[meta.field]) return null;
  const id = String(args[meta.field]);
  const { data, error } = await supabase.from(meta.table).select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  if (meta.table === "tasks") {
    const [{ data: subtasks }, { data: reminders }] = await Promise.all([
      supabase.from("subtasks").select("*").eq("task_id", id).eq("user_id", userId),
      supabase.from("reminders").select("*").eq("target_type", "task").eq("target_id", id).eq("user_id", userId),
    ]);
    return { row: data, subtasks: subtasks ?? [], reminders: reminders ?? [] };
  }
  if (meta.table === "schedule_blocks") {
    const { data: reminders } = await supabase.from("reminders").select("*").eq("target_type", "schedule").eq("target_id", id).eq("user_id", userId);
    return { row: data, reminders: reminders ?? [] };
  }
  return { row: data };
}

export function buildUndoRecord(toolName: string, result: any, before: any) {
  if (!result?.ok) return null;
  const created = CREATE_META[toolName];
  if (created) {
    const value = result[created.resultKey];
    const rows = Array.isArray(value) ? value : value ? [value] : [];
    if (!rows.length) return null;
    return { operation: "create", table_name: created.table, record_ids: rows.map((r:any)=>r.id).filter(Boolean), before_snapshot: null, after_snapshot: rows, undoable: true };
  }
  if (toolName === "log_expenses_batch" && Array.isArray(result.expenses)) {
    return { operation: "create", table_name: "expenses", record_ids: result.expenses.map((r:any)=>r.id).filter(Boolean), before_snapshot: null, after_snapshot: result.expenses, undoable: true };
  }
  const update = UPDATE_META[toolName];
  if (update && result["ok"] && before) {
    const afterValue = result.task || result.expense || result.income || result.goal || result.note || result.reading || result.project || result.account || result.budget || result.subscription || result.item || result.rule || result.reminder || result.habit || result.skill || result.decision || result.block;
    if (result.subtask?.id) return { operation: "update", table_name: "subtasks", record_ids: [result.subtask.id], before_snapshot: before, after_snapshot: result.subtask, undoable: true };
    if (afterValue?.id) return { operation: "update", table_name: before.table || update.table, record_ids: [afterValue.id], before_snapshot: before, after_snapshot: afterValue, undoable: true };
  }
  if (toolName === "delete_subtask" && result.deleted?.id && before) {
    return { operation: "delete", table_name: "subtasks", record_ids: [result.deleted.id], before_snapshot: before, after_snapshot: null, undoable: true };
  }
  if (toolName === "delete_tasks_bulk" && Array.isArray(result.deleted) && before && Array.isArray(before.rows)) {
    const ids = result.deleted.map((r:any)=>r.id).filter(Boolean);
    if (!ids.length) return null;
    return { operation: "delete", table_name: "tasks", record_ids: ids, before_snapshot: { rows: before.rows, subtasks: before.subtasks ?? [], reminders: before.reminders ?? [] }, after_snapshot: null, undoable: true };
  }
  const deletion = DELETE_IDS[toolName];
  if (toolName === "delete_health_log" && result.deleted?.id && before?.table) {
    return { operation: "delete", table_name: before.table, record_ids: [result.deleted.id], before_snapshot: before, after_snapshot: null, undoable: true };
  }
  if (deletion?.table && result.deleted?.id && before) {
    return { operation: "delete", table_name: deletion.table, record_ids: [result.deleted.id], before_snapshot: before, after_snapshot: null, undoable: true };
  }
  return null;
}

export function sanitizeBeforeForRestore(table: string, snapshot: any) {
  if (!snapshot) return null;
  if (table === "tasks" && snapshot.row) return stripForUpdate(snapshot.row);
  return stripForUpdate(snapshot.row ?? snapshot);
}
