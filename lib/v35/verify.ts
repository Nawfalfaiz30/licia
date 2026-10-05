import type { SupabaseClient } from "@supabase/supabase-js";
import { isMutationToolName } from "./agent";

const TABLES: Record<string, string> = {
  create_task: "tasks", create_task_with_subtasks: "tasks", update_task: "tasks", delete_task: "tasks",
  create_task_from_inbox: "tasks", create_task_from_note: "tasks", create_task_from_project: "tasks", create_task_from_goal: "tasks", create_task_from_schedule: "tasks",
  create_note: "brain_dump_notes", update_note: "brain_dump_notes", delete_note: "brain_dump_notes",
  create_project: "projects", update_project: "projects", delete_project: "projects",
  create_goal: "goals", update_goal: "goals", delete_goal: "goals",
  create_daily_schedule: "schedule_blocks", create_schedule_from_task: "schedule_blocks", update_schedule_block: "schedule_blocks", delete_schedule_block: "schedule_blocks", delete_schedule_blocks_bulk: "schedule_blocks",
  create_reminder: "reminders", update_reminder: "reminders", delete_reminder: "reminders", delete_all_reminders: "reminders",
  create_subscription: "subscriptions", update_subscription: "subscriptions", delete_subscription: "subscriptions",
  create_ai_watcher: "ai_watchers", update_ai_watcher: "ai_watchers", delete_ai_watcher: "ai_watchers",
  create_task_dependency: "life_os_task_dependencies", delete_task_dependency: "life_os_task_dependencies", delete_subtask: "subtasks",
  log_expense: "expenses", update_expense: "expenses", delete_expense: "expenses", log_expenses_batch: "expenses",
  log_income: "incomes", update_income: "incomes", delete_income: "incomes",
  create_budget: "budgets", update_budget: "budgets", delete_budget: "budgets",
  create_habit: "habits", update_habit: "habits", delete_habit: "habits",
  create_automation: "automations", update_automation: "automations", delete_automation: "automations",
  save_memory: "user_memories", delete_memory: "user_memories",
  create_vault_item: "vault_items", update_vault_item: "vault_items", delete_vault_item: "vault_items",
  log_decision: "decisions", update_decision: "decisions", delete_decision: "decisions",
  log_reading: "reading_logs", update_reading: "reading_logs", delete_reading: "reading_logs",
  mark_notification_read: "notification_events", transfer_money: "account_transfers",
  create_skill: "skills", update_skill: "skills", delete_skill: "skills",
};

function findId(result: any) {
  if (!result || typeof result !== "object") return null;
  if (typeof result.deleted === "string") return { id: result.deleted, deleted: true };
  if (result.deleted && typeof result.deleted === "object" && typeof result.deleted.id === "string") return { id: result.deleted.id, deleted: true };
  const candidates = ["record", "task", "note", "project", "goal", "reminder", "schedule", "subscription", "watcher", "dependency", "expense", "income", "budget", "habit", "automation", "memory", "vault", "decision", "skill", "notification", "transfer", "block", "created", "updated"];
  for (const key of candidates) {
    const value = result[key];
    if (value && typeof value === "object" && typeof value.id === "string") return { id: value.id, deleted: false };
  }
  if (typeof result.entityId === "string") return { id: result.entityId, deleted: false };
  return null;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("id-ID");
}

function sameTimestamp(a: unknown, b: unknown) {
  if (a == null || b == null || a === "" || b === "") return true;
  const left = new Date(String(a)).getTime();
  const right = new Date(String(b)).getTime();
  if (Number.isFinite(left) && Number.isFinite(right)) return Math.abs(left - right) < 2000;
  return normalize(a) === normalize(b);
}

function expectedMatchesRow(tool: string, args: Record<string, any>, row: Record<string, any>) {
  if (["create_task", "create_task_with_subtasks", "create_task_from_inbox", "create_task_from_note", "create_task_from_project", "create_task_from_goal", "create_task_from_schedule"].includes(tool)) {
    if (args.title && normalize(row.title) !== normalize(args.title)) return false;
    if (args.priority && normalize(row.priority) !== normalize(args.priority)) return false;
    if (args.due_at && !sameTimestamp(row.due_at, args.due_at)) return false;
  }
  if (tool === "create_project") {
    if (args.name && normalize(row.name) !== normalize(args.name)) return false;
    if (args.status && normalize(row.status) !== normalize(args.status)) return false;
  }
  if (tool === "create_goal") {
    if (args.title && normalize(row.title) !== normalize(args.title)) return false;
    if (args.target_date && String(row.target_date || "") !== String(args.target_date || "")) return false;
  }
  if (tool === "create_note") {
    if (args.title && normalize(row.title) !== normalize(args.title)) return false;
  }
  if (tool === "log_expense") {
    if (Number.isFinite(Number(args.amount)) && Number(row.amount) !== Number(args.amount)) return false;
    if (args.category && normalize(row.category) !== normalize(args.category)) return false;
    if (args.account_id && String(row.account_id || "") !== String(args.account_id)) return false;
    if (args.note && normalize(row.note) !== normalize(args.note)) return false;
    return true;
  }
  if (tool === "log_income") {
    if (Number.isFinite(Number(args.amount)) && Number(row.amount) !== Number(args.amount)) return false;
    if (args.source && normalize(row.source) !== normalize(args.source)) return false;
    if (args.account_id && String(row.account_id || "") !== String(args.account_id)) return false;
    return true;
  }
  if (["create_schedule_from_task", "create_schedule_from_goal", "create_schedule_from_project"].includes(tool)) {
    if (args.block_date && String(row.block_date) !== String(args.block_date)) return false;
    if (args.start_time && String(row.start_time).slice(0, 8) !== String(args.start_time).slice(0, 8)) return false;
    if (args.end_time && String(row.end_time).slice(0, 8) !== String(args.end_time).slice(0, 8)) return false;
    if (args.title && normalize(row.title) !== normalize(args.title)) return false;
  }
  if (tool === "update_schedule_block") {
    if (args.block_date && String(row.block_date) !== String(args.block_date)) return false;
    if (args.start_time && String(row.start_time).slice(0, 8) !== String(args.start_time).slice(0, 8)) return false;
    if (args.end_time && String(row.end_time).slice(0, 8) !== String(args.end_time).slice(0, 8)) return false;
  }
  return true;
}

export async function verifyMutationResult(
  supabase: SupabaseClient,
  userId: string,
  tool: string,
  result: any,
  expectedArgs: Record<string, any> = {},
) {
  if (!isMutationToolName(tool) || !result?.ok) return { ...result, verified: false, verification: "tool-contract" };

  if (tool === "create_daily_schedule" && Array.isArray(result.blocks)) {
    const ids = result.blocks.map((x: any) => x?.id).filter(Boolean).slice(0, 30);
    if (!ids.length) return { ...result, verified: false, verification: "database-mismatch" };
    const { data, error } = await supabase.from("schedule_blocks").select("id,block_date,start_time,end_time,title,location,description,task_id").eq("user_id", userId).in("id", ids);
    if (error) return { ...result, verified: false, verification: "query-error", verificationError: error.message };
    const rows = data ?? [];
    const byId = new Map(rows.map((row: any) => [String(row.id), row]));
    const expectedBlocks = result.blocks as any[];
    const verified = rows.length === ids.length && ids.every((id: string) => {
      const row = byId.get(String(id));
      const expected = expectedBlocks.find((block: any) => String(block?.id) === String(id));
      if (!row || !expected) return false;
      return Boolean(String(row.block_date || "").trim() && String(row.start_time || "").trim() && String(row.end_time || "").trim() && String(row.title || "").trim())
        && expectedMatchesRow("create_schedule_from_task", expected, row);
    });
    return { ...result, verified, verification: verified ? "database-readback-batch" : "database-mismatch" };
  }

  if (tool === "log_expenses_batch" && Array.isArray(result.expenses)) {
    const ids = result.expenses.map((x: any) => x?.id).filter(Boolean).slice(0, 100);
    if (!ids.length) return { ...result, verified: false, verification: "database-mismatch" };
    const { data, error } = await supabase.from("expenses").select("id,amount,category,note,account_id,occurred_at").eq("user_id", userId).in("id", ids);
    if (error) return { ...result, verified: false, verification: "query-error", verificationError: error.message };
    const rows = data ?? [];
    const byId = new Map(rows.map((row: any) => [String(row.id), row]));
    const expectedItems = result.expenses as any[];
    const verified = rows.length === ids.length && ids.every((id: string) => {
      const row = byId.get(String(id));
      const expected = expectedItems.find((item: any) => String(item?.id) === String(id));
      if (!row || !expected) return false;
      return Number(row.amount) === Number(expected.amount)
        && normalize(row.category) === normalize(expected.category)
        && (!expected.note || normalize(row.note) === normalize(expected.note));
    });
    return { ...result, verified, verification: verified ? "database-readback-batch" : "database-mismatch" };
  }

  if (tool === "delete_all_reminders") {
    const { count, error } = await supabase.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (error) return { ...result, verified: false, verification: "query-error", verificationError: error.message };
    const remaining = Number(count ?? 0);
    const expectedDeleted = Number(result.deleted ?? 0);
    const verified = result.ok === true && expectedDeleted > 0 && remaining === 0;
    return { ...result, remaining, verified, verification: verified ? "database-readback-bulk-delete" : "database-mismatch" };
  }

  const table = TABLES[tool];
  const target = findId(result);
  if (!table || !target) {
    return { ...result, verified: false, verification: !table ? "unmapped-mutation" : "missing-result-id" };
  }

  try {
    const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).eq("id", target.id).maybeSingle();
    if (error) return { ...result, verified: false, verification: "query-error", verificationError: error.message };
    const exists = Boolean(data);
    const verified = target.deleted ? !exists : exists && expectedMatchesRow(tool, expectedArgs, data as Record<string, any>);
    return { ...result, verified, verification: verified ? "database-readback" : "database-mismatch" };
  } catch (error) {
    return { ...result, verified: false, verification: "query-error", verificationError: error instanceof Error ? error.message : "verification failed" };
  }
}
