import { redactVaultContent } from "@/lib/ai/vaultRedact";
import { getLifeOsCapabilities } from "@/lib/ai/capabilities";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dateStrInTimezone,
  startOfDayIsoForTimezone,
  endOfDayIsoForTimezone,
  startOfMonthIsoForTimezone,
  startOfWeekIsoForTimezone,
  ensureTimezoneOffset,
  formatDateTimeInTimezone,
  formatTimeInTimezone,
} from "@/lib/date";
import {
  createDefaultTaskReminder,
  getDefaultReminderMinutes,
  createDefaultScheduleReminder,
  syncExistingScheduleReminder,
  syncExistingTaskReminder,
} from "@/lib/reminders/schedule";
import { cancelTaskReminders, cancelScheduleReminders } from "@/lib/domain/reminderLifecycle";
import { emitLifeEvent } from "@/lib/events/bus";
import { resolveNaturalDate, validateWeekdayDate, buildTemporalContext } from "@/lib/v36/temporal";
import type OpenAI from "openai";

type ToolDef = OpenAI.Chat.Completions.ChatCompletionTool;

// ---- Tool schemas sent to OpenAI ------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown) {
  return UUID_RE.test(String(value || "").trim());
}

function normalizeMoneyAmount(value: unknown): number {
  if (typeof value === "number") return value;
  const raw = String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/rp\.?\s*/g, "")
    .replace(/\s/g, "");
  if (!raw) return Number.NaN;
  const match = raw.match(/^([0-9]+(?:[.,][0-9]+)?)(k|rb|ribu|jt|juta)?$/i);
  if (!match) return Number(raw.replace(/\./g, "").replace(/,/g, "."));
  const base = Number(match[1].replace(/,/g, "."));
  const suffix = String(match[2] || "").toLowerCase();
  const multiplier =
    suffix === "k" || suffix === "rb" || suffix === "ribu" ? 1000 : suffix === "jt" || suffix === "juta" ? 1000000 : 1;
  return base * multiplier;
}

import { toolDefs } from "@/lib/ai/toolDefinitions";

export type HandlerCtx = { supabase: SupabaseClient; userId: string; timezone: string };

function isCashAccount(row: any) {
  const type = String(row?.account_type || "")
    .trim()
    .toLowerCase();
  const name = String(row?.name || "")
    .trim()
    .toLowerCase();
  return type === "cash" || /^(tunai|uang tunai|cash)$/.test(name);
}

async function resolveExpenseSourceAccount(ctx: HandlerCtx, accountId?: unknown, accountName?: unknown) {
  const explicitId = typeof accountId === "string" && accountId.trim();
  const explicitName = typeof accountName === "string" && accountName.trim();
  if (explicitId || explicitName) return resolveAccount(ctx, accountId, accountName);

  const { data, error } = await ctx.supabase
    .from("accounts")
    .select("id,name,starting_balance,account_type,is_default,created_at")
    .eq("user_id", ctx.userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  const accounts = data ?? [];
  const cashAccounts = accounts.filter(isCashAccount);
  if (cashAccounts.length) {
    const preferred =
      cashAccounts.find(
        (row: any) =>
          String(row.name || "")
            .trim()
            .toLowerCase() === "tunai",
      ) ||
      cashAccounts.find((row: any) => row.is_default) ||
      cashAccounts[0];
    return { ok: true as const, account: preferred, inferred: true, source_default: "cash" as const };
  }

  // Older installs may have no cash wallet at all. Create the implicit Tunai wallet
  // so an ordinary expense can always be linked to a real account and reflected in balance.
  const { data: created, error: createError } = await ctx.supabase
    .from("accounts")
    .insert({ user_id: ctx.userId, name: "Tunai", starting_balance: 0, account_type: "cash", is_default: false })
    .select("id,name,starting_balance,account_type,is_default,created_at")
    .single();
  if (!createError && created)
    return {
      ok: true as const,
      account: created,
      inferred: true,
      source_default: "cash" as const,
      created_account: true,
    };

  // Concurrent request may have created it between the read and insert.
  const { data: retry } = await ctx.supabase
    .from("accounts")
    .select("id,name,starting_balance,account_type,is_default,created_at")
    .eq("user_id", ctx.userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  const recovered = (retry ?? []).find(isCashAccount);
  if (recovered) return { ok: true as const, account: recovered, inferred: true, source_default: "cash" as const };

  return {
    ok: false as const,
    error: createError?.message || "Dompet Tunai belum tersedia dan tidak dapat dibuat otomatis.",
  };
}

async function resolveAccount(ctx: HandlerCtx, accountId?: unknown, accountName?: unknown) {
  const id = typeof accountId === "string" ? accountId.trim() : "";
  const name = typeof accountName === "string" ? accountName.trim() : "";
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  // Models sometimes place a human label in account_id. Never send a non-UUID
  // value to a UUID column; treat it as a possible account name instead.
  const safeId = id && isUuid(id) ? id : "";
  const fallbackName = name || (id && !safeId ? id : "");

  if (safeId) {
    const { data, error } = await ctx.supabase
      .from("accounts")
      .select("id,name,starting_balance,account_type,is_default")
      .eq("id", safeId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!data) return { ok: false as const, error: "Dompet yang diminta tidak ditemukan." };
    return { ok: true as const, account: data };
  }

  if (fallbackName) {
    const { data, error } = await ctx.supabase
      .from("accounts")
      .select("id,name,starting_balance,account_type,is_default")
      .eq("user_id", ctx.userId)
      .ilike("name", `%${fallbackName.replace(/[%_]/g, "\\$&")}%`);
    if (error) return { ok: false as const, error: error.message };
    const exact = (data ?? []).find((row: any) => String(row.name).trim().toLowerCase() === fallbackName.toLowerCase());
    if (exact) return { ok: true as const, account: exact };
    if (!data?.length)
      return { ok: false as const, status: "account_not_found", error: `Dompet '${fallbackName}' tidak ditemukan.` };
    if (data.length > 1)
      return {
        ok: false as const,
        status: "multiple_accounts",
        candidates: data.map((row: any) => ({ id: row.id, name: row.name, account_type: row.account_type })),
      };
    return { ok: true as const, account: data[0] };
  }

  const { data, error } = await ctx.supabase
    .from("accounts")
    .select("id,name,starting_balance,account_type,is_default")
    .eq("user_id", ctx.userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return { ok: false as const, error: error.message };
  const accounts = data ?? [];
  if (accounts.length === 1) return { ok: true as const, account: accounts[0], inferred: true };
  const defaultAccount = accounts.find((row: any) => row.is_default);
  if (defaultAccount) return { ok: true as const, account: defaultAccount, inferred: true };
  return {
    ok: true as const,
    account: null,
    requires_account: accounts.length > 1,
    candidates: accounts.map((row: any) => ({ id: row.id, name: row.name, account_type: row.account_type })),
  };
}

async function getAccountBalance(ctx: HandlerCtx, accountId: string) {
  const [accountResult, incomeResult, expenseResult, transferInResult, transferOutResult] = await Promise.all([
    ctx.supabase
      .from("accounts")
      .select("id,name,starting_balance,current_balance,account_type,is_default")
      .eq("id", accountId)
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    ctx.supabase.from("incomes").select("amount").eq("user_id", ctx.userId).eq("account_id", accountId),
    ctx.supabase.from("expenses").select("amount").eq("user_id", ctx.userId).eq("account_id", accountId),
    ctx.supabase.from("account_transfers").select("amount").eq("user_id", ctx.userId).eq("to_account_id", accountId),
    ctx.supabase.from("account_transfers").select("amount").eq("user_id", ctx.userId).eq("from_account_id", accountId),
  ]);
  let account: any = accountResult.data;
  if (accountResult.error) {
    const legacy = await ctx.supabase
      .from("accounts")
      .select("id,name,starting_balance,account_type,is_default")
      .eq("id", accountId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    account = legacy.data;
  }
  const incomes = incomeResult.data;
  const expenses = expenseResult.data;
  const transfersIn = transferInResult.data;
  const transfersOut = transferOutResult.data;
  if (!account) return null;
  const income = (incomes ?? []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  const expense = (expenses ?? []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  const transferIn = (transfersIn ?? []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  const transferOut = (transfersOut ?? []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  const currentBalance =
    account.current_balance == null
      ? Number(account.starting_balance || 0) + income - expense + transferIn - transferOut
      : Number(account.current_balance);
  return {
    ...account,
    current_balance: currentBalance,
    income_total: income,
    expense_total: expense,
    transfer_in: transferIn,
    transfer_out: transferOut,
  };
}

async function logExpense(ctx: HandlerCtx, args: any) {
  const amount = normalizeMoneyAmount(args.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Jumlah pengeluaran harus lebih besar dari 0." };

  const resolved = await resolveExpenseSourceAccount(ctx, args.account_id, args.account_name);
  if (!resolved.ok) return resolved;

  const { data, error } = await ctx.supabase
    .from("expenses")
    .insert({
      user_id: ctx.userId,
      amount,
      category: args.category,
      note: args.note ?? null,
      account_id: resolved.account?.id ?? null,
      occurred_at: ensureTimezoneOffset(args.occurred_at, ctx.timezone) ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  const balance = resolved.account?.id ? await getAccountBalance(ctx, resolved.account.id) : null;
  return {
    ok: true,
    expense: data,
    account: balance,
    balance_changed: Boolean(resolved.account?.id),
    inferred_account: Boolean((resolved as any).inferred),
    account_created: Boolean((resolved as any).created_account),
    message: resolved.account
      ? `Pengeluaran dicatat dari ${resolved.account.name}. Saldo dompet sekarang ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(balance?.current_balance ?? 0))}.`
      : "Pengeluaran dicatat tanpa mengaitkan dompet.",
  };
}

async function getExpenseSummary(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("expenses")
    .select("id, amount, category, note, occurred_at")
    .eq("user_id", ctx.userId)
    .gte("occurred_at", args.from_date)
    .lte("occurred_at", `${args.to_date}T23:59:59`);

  if (args.category) query = query.eq("category", args.category);

  const { data, error } = await query.order("occurred_at", { ascending: false });
  if (error) return { ok: false, error: error.message };

  const total = (data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory: Record<string, number> = {};
  for (const e of data ?? []) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
  }

  return { ok: true, total, count: data?.length ?? 0, by_category: byCategory, items: data };
}

async function deleteExpense(ctx: HandlerCtx, args: any) {
  // Step 2: user already confirmed a specific id from a prior candidate list.
  if (args.confirm_expense_id) {
    const { data, error } = await ctx.supabase
      .from("expenses")
      .delete()
      .eq("id", args.confirm_expense_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }

  // Step 1: search candidates. Never delete here, even if there's exactly one match
  // requires it to be unambiguous — but per rule #2, one match may auto-delete only
  // when the model is confident; to stay safe, we still return it as a single-item
  // candidate list and let the model confirm in the same turn if it's clearly correct.
  let query = ctx.supabase.from("expenses").select("id, amount, category, note, occurred_at").eq("user_id", ctx.userId);

  if (args.keyword) {
    const key = String(args.keyword)
      .replace(/[%,()]/g, " ")
      .trim();
    if (key) query = query.or(`note.ilike.%${key}%,category.ilike.%${key}%`);
  }
  if (args.from_date) query = query.gte("occurred_at", args.from_date);
  if (args.to_date) query = query.lte("occurred_at", `${args.to_date}T23:59:59`);

  const { data, error } = await query.order("occurred_at", { ascending: false }).limit(10);
  if (error) return { ok: false, error: error.message };

  if (!data || data.length === 0) {
    return { ok: true, status: "no_match", message: "Tidak ada pengeluaran yang cocok ditemukan." };
  }
  if (data.length > 1) {
    return { ok: true, status: "multiple_candidates", candidates: data };
  }

  // Exactly one candidate: still require explicit confirm to actually delete.
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function logExpensesBatch(ctx: HandlerCtx, args: any) {
  const resolved = await resolveExpenseSourceAccount(ctx, args.account_id, args.account_name);
  if (!resolved.ok) return resolved;

  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) return { ok: false, error: "Tidak ada item untuk dicatat." };
  const invalidItem = items.find((item: any) => {
    const amount = normalizeMoneyAmount(item?.amount);
    return !Number.isFinite(amount) || amount <= 0;
  });
  if (invalidItem) return { ok: false, error: "Ada item transaksi dengan nominal yang tidak valid." };
  const rows = items.map((item: any) => {
    const note = String(item?.note || item?.item_name || item?.category || "Pengeluaran").trim();
    const category = String(item?.category || "Belanja").trim() || "Belanja";
    return {
      user_id: ctx.userId,
      amount: normalizeMoneyAmount(item.amount),
      category,
      note: args.store_name ? `${note} (${args.store_name})` : note,
      account_id: resolved.account?.id ?? null,
      occurred_at: ensureTimezoneOffset(item.occurred_at ?? args.occurred_at, ctx.timezone) ?? new Date().toISOString(),
    };
  });
  const { data, error } = await ctx.supabase.from("expenses").insert(rows).select();
  if (error) return { ok: false, error: error.message };

  const total = rows.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const balance = resolved.account?.id ? await getAccountBalance(ctx, resolved.account.id) : null;
  return {
    ok: true,
    created: data?.length ?? 0,
    total,
    expenses: data,
    account: balance,
    balance_changed: Boolean(resolved.account?.id),
    inferred_account: Boolean((resolved as any).inferred),
    account_created: Boolean((resolved as any).created_account),
    account_name: resolved.account?.name ?? null,
    message: resolved.account
      ? `Berhasil mencatat ${data?.length ?? rows.length} transaksi dari ${resolved.account.name}. Total ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(total)}.`
      : "Transaksi tercatat tanpa dompet.",
  };
}

async function updateExpense(ctx: HandlerCtx, args: any) {
  const expenseId = String(args.expense_id || "").trim();
  if (!isUuid(expenseId))
    return {
      ok: false,
      code: "INVALID_ENTITY_ID",
      error:
        "ID pengeluaran tidak valid. Jangan gunakan nomor urut daftar; cari kembali pengeluaran dan gunakan ID hasil tool.",
      retryable: false,
    };
  const patch: Record<string, any> = {};
  if (args.amount !== undefined) patch.amount = args.amount;
  if (args.category) patch.category = args.category;
  if (args.note !== undefined) patch.note = args.note;
  if (args.occurred_at) patch.occurred_at = ensureTimezoneOffset(args.occurred_at, ctx.timezone);
  const rawAccountId = typeof args.account_id === "string" ? args.account_id.trim() : "";
  const accountIdLooksValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    rawAccountId,
  );
  if (!Object.keys(patch).length)
    return { ok: false, status: "no_changes", message: "Tidak ada perubahan yang diberikan." };
  if (args.account_name || accountIdLooksValid) {
    const resolved = await resolveAccount(ctx, accountIdLooksValid ? rawAccountId : undefined, args.account_name);
    if (!resolved.ok) return resolved;
    if (!resolved.account?.id)
      return { ok: false, status: "account_required", message: "Dompet sumber belum dapat ditentukan." };
    patch.account_id = resolved.account.id;
  }

  const { data, error } = await ctx.supabase
    .from("expenses")
    .update(patch)
    .eq("id", expenseId)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  const balance = data?.account_id ? await getAccountBalance(ctx, String(data.account_id)) : null;
  return { ok: true, expense: data, account: balance };
}

async function createTaskFromSchedule(ctx: HandlerCtx, args: any) {
  const blockId = String(args.schedule_block_id || "").trim();
  if (!blockId) return { ok: false, error: "schedule_block_id wajib diisi." };
  const { data: block, error: blockError } = await ctx.supabase
    .from("schedule_blocks")
    .select("id,block_date,start_time,end_time,title,location,description,task_id,project_id")
    .eq("id", blockId)
    .eq("user_id", ctx.userId)
    .single();
  if (blockError || !block) return { ok: false, error: "Agenda tidak ditemukan." };
  if (block.task_id)
    return {
      ok: false,
      status: "already_linked",
      task_id: block.task_id,
      message: "Agenda ini sudah terhubung ke tugas.",
    };
  const descriptionParts = [
    block.description,
    block.location ? `Lokasi: ${block.location}` : null,
    `Dibuat dari agenda ${block.block_date} ${String(block.start_time).slice(0, 5)}–${String(block.end_time).slice(0, 5)}.`,
  ].filter(Boolean);
  const { data: task, error: taskError } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title: String(args.title || block.title).trim(),
      description: descriptionParts.join("\n") || null,
      status: "todo",
      priority: args.priority || "medium",
      due_at: ensureTimezoneOffset(
        args.due_at || `${block.block_date}T${String(block.end_time).slice(0, 8)}`,
        ctx.timezone,
      ),
      estimated_minutes:
        Number(args.estimated_minutes) ||
        Math.max(
          1,
          Math.round(
            Number(String(block.end_time).slice(0, 2)) * 60 +
              Number(String(block.end_time).slice(3, 5)) -
              (Number(String(block.start_time).slice(0, 2)) * 60 + Number(String(block.start_time).slice(3, 5))),
          ),
        ) ||
        null,
      project_id: block.project_id || null,
    })
    .select()
    .single();
  if (taskError || !task) return { ok: false, error: taskError?.message || "Tugas gagal dibuat." };
  const { error: linkError } = await ctx.supabase
    .from("schedule_blocks")
    .update({ task_id: task.id })
    .eq("id", block.id)
    .eq("user_id", ctx.userId);
  if (linkError) {
    await ctx.supabase.from("tasks").delete().eq("id", task.id).eq("user_id", ctx.userId);
    return { ok: false, error: linkError.message };
  }
  return { ok: true, task, schedule: block, linked: true };
}

async function getLifeGraph(ctx: HandlerCtx, args: any) {
  const entityType = String(args?.entity_type || "").trim();
  const entityId = String(args?.entity_id || "").trim();
  const depth = Math.min(2, Math.max(1, Number(args?.depth || 1)));
  if (!entityId || !isUuid(entityId))
    return { ok: false, code: "INVALID_ENTITY_ID", error: "entity_id wajib berupa UUID nyata." };

  const baseConfig: Record<string, { table: string; select: string }> = {
    task: { table: "tasks", select: "id,title,status,priority,due_at,description,project_id,area_id" },
    project: { table: "projects", select: "id,name,status,target_date,goal_id" },
    goal: { table: "goals", select: "id,title,status,progress,target_date,next_step" },
    schedule: {
      table: "schedule_blocks",
      select: "id,title,block_date,start_time,end_time,location,task_id,project_id",
    },
    note: { table: "brain_dump_notes", select: "id,title,content,tags,pinned,updated_at" },
    inbox: { table: "smart_inbox_items", select: "id,content,kind,status,linked_task_id,linked_note_id,created_at" },
    habit: { table: "habits", select: "id,name,target_per_week,goal_id" },
    subscription: { table: "subscriptions", select: "id,name,amount,billing_cycle,next_billing_date,active" },
    account: { table: "accounts", select: "id,name,starting_balance,account_type,is_default" },
    expense: { table: "expenses", select: "id,amount,category,note,occurred_at,account_id" },
    income: { table: "incomes", select: "id,amount,source,note,occurred_at,account_id" },
    memory: { table: "user_memories", select: "id,category,memory_key,memory_value,enabled,updated_at" },
    decision: { table: "decisions", select: "id,title,decision,review_date,outcome,updated_at" },
    reading: { table: "reading_logs", select: "id,title,status,progress,rating,updated_at" },
  };
  const config = baseConfig[entityType];
  if (!config) return { ok: false, error: "Entity type tidak didukung oleh Life Graph." };

  const rootQuery: any = ctx.supabase
    .from(config.table)
    .select(config.select)
    .eq("user_id", ctx.userId)
    .eq("id", entityId);
  const rootResult: any = await rootQuery.maybeSingle();
  const root: any = rootResult?.data;
  const rootError: any = rootResult?.error;
  if (rootError) return { ok: false, error: rootError.message };
  if (!root) return { ok: false, status: "not_found", error: "Entity tidak ditemukan." };

  const graph: Record<string, unknown> = { entity: { type: entityType, data: root }, relations: [] as unknown[] };
  const relations: any[] = [];
  const push = (type: string, data: unknown) => {
    if (Array.isArray(data) ? data.length : data) relations.push({ type, data });
  };

  if (entityType === "task") {
    if (root.project_id) {
      const { data } = await ctx.supabase
        .from("projects")
        .select("id,name,status,target_date,goal_id")
        .eq("user_id", ctx.userId)
        .eq("id", root.project_id)
        .maybeSingle();
      push("project", data);
      if (depth >= 2 && data?.goal_id) {
        const { data: goal } = await ctx.supabase
          .from("goals")
          .select("id,title,status,progress,target_date,next_step")
          .eq("user_id", ctx.userId)
          .eq("id", data.goal_id)
          .maybeSingle();
        push("goal", goal);
      }
    }
    const [schedules, focus, subtasks] = await Promise.all([
      ctx.supabase
        .from("schedule_blocks")
        .select("id,title,block_date,start_time,end_time,project_id")
        .eq("user_id", ctx.userId)
        .eq("task_id", entityId)
        .order("block_date", { ascending: true })
        .limit(4),
      ctx.supabase
        .from("pomodoro_sessions")
        .select("id,focus_minutes,started_at,completed")
        .eq("user_id", ctx.userId)
        .eq("task_id", entityId)
        .order("started_at", { ascending: false })
        .limit(6),
      ctx.supabase
        .from("subtasks")
        .select("id,title,status")
        .eq("user_id", ctx.userId)
        .eq("task_id", entityId)
        .limit(12),
    ]);
    push("schedule", schedules.data);
    push("focus", focus.data);
    push("subtasks", subtasks.data);
  } else if (entityType === "project") {
    if (root.goal_id) {
      const { data } = await ctx.supabase
        .from("goals")
        .select("id,title,status,progress,target_date,next_step")
        .eq("user_id", ctx.userId)
        .eq("id", root.goal_id)
        .maybeSingle();
      push("goal", data);
    }
    const [tasks, schedules] = await Promise.all([
      ctx.supabase
        .from("tasks")
        .select("id,title,status,priority,due_at,project_id")
        .eq("user_id", ctx.userId)
        .eq("project_id", entityId)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(12),
      ctx.supabase
        .from("schedule_blocks")
        .select("id,title,block_date,start_time,end_time,task_id")
        .eq("user_id", ctx.userId)
        .eq("project_id", entityId)
        .order("block_date", { ascending: true })
        .limit(8),
    ]);
    push("tasks", tasks.data);
    push("schedule", schedules.data);
  } else if (entityType === "goal") {
    const [projects, milestones] = await Promise.all([
      ctx.supabase
        .from("projects")
        .select("id,name,status,target_date,goal_id")
        .eq("user_id", ctx.userId)
        .eq("goal_id", entityId)
        .limit(8),
      ctx.supabase
        .from("goal_milestones")
        .select("id,title,status,target_date,position")
        .eq("user_id", ctx.userId)
        .eq("goal_id", entityId)
        .order("position", { ascending: true })
        .limit(12),
    ]);
    push("projects", projects.data);
    push("milestones", milestones.data);
    if (depth >= 2 && projects.data?.length) {
      const projectIds = projects.data.map((project: any) => project.id).filter(isUuid);
      if (projectIds.length) {
        const { data: tasks } = await ctx.supabase
          .from("tasks")
          .select("id,title,status,priority,due_at,project_id")
          .eq("user_id", ctx.userId)
          .in("project_id", projectIds)
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(20);
        push("tasks", tasks);
      }
    }
  } else if (entityType === "schedule") {
    if (root.task_id) {
      const { data } = await ctx.supabase
        .from("tasks")
        .select("id,title,status,priority,due_at,project_id")
        .eq("user_id", ctx.userId)
        .eq("id", root.task_id)
        .maybeSingle();
      push("task", data);
    }
    if (root.project_id) {
      const { data } = await ctx.supabase
        .from("projects")
        .select("id,name,status,target_date,goal_id")
        .eq("user_id", ctx.userId)
        .eq("id", root.project_id)
        .maybeSingle();
      push("project", data);
    }
    const { data: reminders } = await ctx.supabase
      .from("reminders")
      .select("id,title,remind_at,status,enabled,offset_minutes")
      .eq("user_id", ctx.userId)
      .eq("target_type", "schedule")
      .eq("target_id", entityId)
      .limit(6);
    push("reminders", reminders);
  } else if (entityType === "inbox") {
    if (root.linked_task_id) {
      const { data } = await ctx.supabase
        .from("tasks")
        .select("id,title,status,priority,due_at,project_id")
        .eq("user_id", ctx.userId)
        .eq("id", root.linked_task_id)
        .maybeSingle();
      push("task", data);
    }
    if (root.linked_note_id) {
      const { data } = await ctx.supabase
        .from("brain_dump_notes")
        .select("id,title,content,tags,updated_at")
        .eq("user_id", ctx.userId)
        .eq("id", root.linked_note_id)
        .maybeSingle();
      push("note", data);
    }
  } else if (entityType === "habit" && root.goal_id) {
    const { data } = await ctx.supabase
      .from("goals")
      .select("id,title,status,progress,target_date,next_step")
      .eq("user_id", ctx.userId)
      .eq("id", root.goal_id)
      .maybeSingle();
    push("goal", data);
  } else if ((entityType === "expense" || entityType === "income") && root.account_id) {
    const { data } = await ctx.supabase
      .from("accounts")
      .select("id,name,account_type,is_default")
      .eq("user_id", ctx.userId)
      .eq("id", root.account_id)
      .maybeSingle();
    push("account", data);
  }

  graph.relations = relations;
  return { ok: true, depth, graph };
}

async function getLifeModuleData(ctx: HandlerCtx, args: any) {
  const moduleName = String(args.module || "").trim();
  const limit = Math.min(30, Math.max(1, Number(args.limit) || 12));
  const keyword = String(args.keyword || "").trim();
  const like = keyword ? `%${keyword.replace(/[%_]/g, "\\$&")}%` : null;
  try {
    const q = (table: string, select: string) => {
      let query: any = ctx.supabase.from(table).select(select).eq("user_id", ctx.userId);
      return query;
    };
    if (moduleName === "inbox") {
      let query = q(
        "smart_inbox_items",
        "id,content,kind,status,ai_suggestion,linked_task_id,linked_note_id,created_at,processed_at",
      );
      if (keyword) query = query.ilike("content", like);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, module: moduleName, items: data ?? [] };
    }
    if (moduleName === "journal") {
      let query = q("journal_entries", "id,mood_score,content,created_at");
      if (keyword) query = query.ilike("content", like);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, module: moduleName, items: data ?? [] };
    }
    if (moduleName === "relations") {
      let query = q("social_relations", "id,contact_name,importance,contact_frequency_days,birthday,notes,created_at");
      if (keyword) query = query.ilike("contact_name", like);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, module: moduleName, items: data ?? [] };
    }
    if (moduleName === "interactions") {
      const { data, error } = await q("social_interactions", "id,relation_id,note,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, module: moduleName, items: data ?? [] };
    }
    if (moduleName === "anime") {
      let query = q(
        "anime_watchlist",
        "id,title,status,watched_episodes,total_episodes,score,broadcast_day_wib,broadcast_time_wib,updated_at",
      );
      if (keyword) query = query.ilike("title", like);
      const { data, error } = await query.order("updated_at", { ascending: false }).limit(limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, module: moduleName, items: data ?? [] };
    }
    if (moduleName === "reading_sessions") {
      const { data, error } = await q("reading_sessions", "id,reading_id,minutes,pages_read,note,started_at,created_at")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, module: moduleName, items: data ?? [] };
    }
    if (moduleName === "habits") {
      const { data, error } = await q("habits", "id,name,target_per_week,icon,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, module: moduleName, items: data ?? [] };
    }
    if (moduleName === "health") {
      const [sleep, hydration, caffeine, meals, medication, fatigue, movement, metrics] = await Promise.all([
        q("sleep_logs", "id,sleep_start,sleep_end,quality,created_at")
          .order("sleep_end", { ascending: false })
          .limit(5),
        q("hydration_logs", "id,amount_ml,logged_at").order("logged_at", { ascending: false }).limit(8),
        q("caffeine_logs", "id,drink,mg_estimate,logged_at").order("logged_at", { ascending: false }).limit(8),
        q("meal_logs", "id,meal_type,description,logged_at").order("logged_at", { ascending: false }).limit(8),
        q("medication_logs", "id,medication_name,dosage,logged_at").order("logged_at", { ascending: false }).limit(8),
        q("fatigue_logs", "id,fatigue_score,note,logged_at").order("logged_at", { ascending: false }).limit(8),
        q("movement_logs", "id,activity,duration_minutes,intensity,note,logged_at")
          .order("logged_at", { ascending: false })
          .limit(8),
        q("health_metrics", "id,weight_kg,systolic,diastolic,resting_hr,note,measured_at")
          .order("measured_at", { ascending: false })
          .limit(5),
      ]);
      return {
        ok: true,
        module: moduleName,
        items: {
          sleep: sleep.data ?? [],
          hydration: hydration.data ?? [],
          caffeine: caffeine.data ?? [],
          meals: meals.data ?? [],
          medication: medication.data ?? [],
          fatigue: fatigue.data ?? [],
          movement: movement.data ?? [],
          metrics: metrics.data ?? [],
        },
      };
    }
    if (moduleName === "finance") {
      const [expenses, incomes, accounts, transfers, budgets, subscriptions] = await Promise.all([
        q("expenses", "id,amount,category,note,occurred_at,account_id")
          .order("occurred_at", { ascending: false })
          .limit(limit),
        q("incomes", "id,amount,source,note,occurred_at,account_id")
          .order("occurred_at", { ascending: false })
          .limit(limit),
        q("accounts", "id,name,starting_balance,account_type,is_default,created_at")
          .order("created_at", { ascending: false })
          .limit(limit),
        q("account_transfers", "id,amount,from_account_id,to_account_id,note,occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(limit),
        q("budgets", "id,category,limit_amount,period,created_at")
          .order("created_at", { ascending: false })
          .limit(limit),
        q("subscriptions", "id,name,amount,billing_cycle,next_billing_date,category,active")
          .order("next_billing_date", { ascending: true })
          .limit(limit),
      ]);
      return {
        ok: true,
        module: moduleName,
        items: {
          expenses: expenses.data ?? [],
          incomes: incomes.data ?? [],
          accounts: accounts.data ?? [],
          transfers: transfers.data ?? [],
          budgets: budgets.data ?? [],
          subscriptions: subscriptions.data ?? [],
        },
      };
    }
    if (moduleName === "productivity") {
      const [tasks, schedule, projects, goals, pomodoro, milestones] = await Promise.all([
        q("tasks", "id,title,status,priority,due_at,estimated_minutes,project_id,area_id")
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(limit),
        q("schedule_blocks", "id,title,block_date,start_time,end_time,location,description,task_id,project_id")
          .order("block_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(limit),
        q("projects", "id,name,status,target_date,goal_id,area_id,updated_at")
          .order("updated_at", { ascending: false })
          .limit(limit),
        q("goals", "id,title,progress,status,target_date,next_step,description")
          .order("updated_at", { ascending: false })
          .limit(limit),
        q("pomodoro_sessions", "id,task_id,focus_minutes,started_at,completed")
          .order("started_at", { ascending: false })
          .limit(limit),
        q("goal_milestones", "id,goal_id,title,status,target_date,position")
          .order("position", { ascending: true })
          .limit(limit),
      ]);
      return {
        ok: true,
        module: moduleName,
        items: {
          tasks: tasks.data ?? [],
          schedule: schedule.data ?? [],
          projects: projects.data ?? [],
          goals: goals.data ?? [],
          pomodoro: pomodoro.data ?? [],
          milestones: milestones.data ?? [],
        },
      };
    }
    return { ok: false, error: "Modul tidak didukung." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membaca modul." };
  }
}

const AI_CRUD_DEFINITIONS: Record<string, { table: string; fields: string[]; readOnly?: boolean; sort?: string }> = {
  area: { table: "areas", fields: ["name", "icon", "color"], sort: "updated_at" },
  expense: {
    table: "expenses",
    fields: ["amount", "category", "note", "account_id", "occurred_at"],
    sort: "occurred_at",
  },
  income: { table: "incomes", fields: ["amount", "source", "note", "account_id", "occurred_at"], sort: "occurred_at" },
  account: {
    table: "accounts",
    fields: ["name", "starting_balance", "account_type", "is_default"],
    sort: "created_at",
  },
  budget: { table: "budgets", fields: ["category", "limit_amount", "period"], sort: "created_at" },
  subscription: {
    table: "subscriptions",
    fields: ["name", "amount", "billing_cycle", "next_billing_date", "category", "active"],
    sort: "next_billing_date",
  },
  journal_entry: { table: "journal_entries", fields: ["mood_score", "content"], sort: "created_at" },
  relation: {
    table: "social_relations",
    fields: ["contact_name", "importance", "contact_frequency_days", "birthday", "notes", "group_type"],
    sort: "created_at",
  },
  interaction: { table: "social_interactions", fields: ["relation_id", "note", "occurred_at"], sort: "occurred_at" },
  sleep: { table: "sleep_logs", fields: ["sleep_start", "sleep_end", "quality"], sort: "sleep_end" },
  hydration: { table: "hydration_logs", fields: ["amount_ml", "logged_at"], sort: "logged_at" },
  caffeine: { table: "caffeine_logs", fields: ["drink", "mg_estimate", "logged_at"], sort: "logged_at" },
  meal: {
    table: "meal_logs",
    fields: ["meal_type", "description", "calories", "protein_g", "carbs_g", "fat_g", "logged_at"],
    sort: "logged_at",
  },
  medication: { table: "medication_logs", fields: ["medication_name", "dosage", "logged_at"], sort: "logged_at" },
  fatigue: { table: "fatigue_logs", fields: ["fatigue_score", "note", "logged_at"], sort: "logged_at" },
  movement: {
    table: "movement_logs",
    fields: ["activity", "duration_minutes", "intensity", "note", "logged_at"],
    sort: "logged_at",
  },
  health_metric: {
    table: "health_metrics",
    fields: ["weight_kg", "systolic", "diastolic", "resting_hr", "note", "measured_at"],
    sort: "measured_at",
  },
  daily_plan: { table: "daily_plans", fields: ["week_start", "plan"], sort: "week_start" },
  reading_session: {
    table: "reading_sessions",
    fields: ["reading_id", "minutes", "pages_read", "note", "started_at"],
    sort: "started_at",
  },
  milestone: {
    table: "goal_milestones",
    fields: ["goal_id", "title", "status", "target_date", "position"],
    sort: "position",
  },
  link: {
    table: "life_os_entity_links",
    fields: [
      "source_type",
      "source_id",
      "relation",
      "target_type",
      "target_id",
      "confidence",
      "metadata",
      "created_by",
    ],
    sort: "created_at",
  },
  notification_event: {
    table: "notification_events",
    fields: ["title", "body", "href", "tone", "source_type", "source_id", "scheduled_at", "delivered_at", "read_at"],
    sort: "created_at",
  },
  smart_inbox_item: {
    table: "smart_inbox_items",
    fields: ["content", "kind", "status", "ai_suggestion", "linked_task_id", "linked_note_id", "processed_at"],
    sort: "created_at",
  },
  memory: {
    table: "user_memories",
    fields: [
      "category",
      "memory_key",
      "memory_value",
      "enabled",
      "confidence",
      "importance",
      "last_confirmed_at",
      "expires_at",
    ],
    sort: "updated_at",
  },
  daily_snapshot: { table: "life_os_daily_snapshots", fields: [], readOnly: true, sort: "snapshot_date" },
};

function normalizeAiCrudEntityType(value: unknown) {
  const raw = String(value || "")
    .trim()
    .toLocaleLowerCase("id-ID");
  const aliases: Record<string, string> = {
    pengeluaran: "expense",
    pengeluaran_keuangan: "expense",
    transaksi_pengeluaran: "expense",
    pemasukan: "income",
    pendapatan: "income",
    rekening: "account",
    dompet: "account",
    anggaran: "budget",
    langganan: "subscription",
    subscription: "subscription",
    jurnal: "journal_entry",
    catatan_jurnal: "journal_entry",
    inbox: "smart_inbox_item",
    item_inbox: "smart_inbox_item",
    smart_inbox: "smart_inbox_item",
    memori: "memory",
    user_memory: "memory",
  };
  return aliases[raw] || raw;
}

function sanitizeAiCrudData(entityType: string, input: unknown) {
  const def = AI_CRUD_DEFINITIONS[normalizeAiCrudEntityType(entityType)];
  if (!def || !input || typeof input !== "object" || Array.isArray(input)) return {};
  const allowed = new Set(def.fields);
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).filter(([key]) => allowed.has(key)));
}

function sanitizeAiCrudFilters(entityType: string, input: unknown) {
  const def = AI_CRUD_DEFINITIONS[normalizeAiCrudEntityType(entityType)];
  if (!def || !input || typeof input !== "object" || Array.isArray(input)) return {};
  const allowed = new Set(["id", ...def.fields]);
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).filter(([key]) => allowed.has(key)));
}

async function manageLifeOsData(ctx: HandlerCtx, args: any) {
  const operation = String(args.operation || "read").trim();
  const rawEntityType = String(args.entity_type || "").trim();
  const entityType = normalizeAiCrudEntityType(rawEntityType);
  if (
    ["schedule", "schedule_block", "calendar", "calendar_event", "agenda"].includes(entityType) ||
    ["schedule", "schedule_block", "calendar", "calendar_event", "agenda"].includes(rawEntityType)
  ) {
    return {
      ok: false,
      retryable: false,
      code: "USE_CALENDAR_TOOL",
      error: "Untuk agenda kalender gunakan create_daily_schedule atau update_schedule_block, bukan fallback CRUD.",
    };
  }
  const def = AI_CRUD_DEFINITIONS[entityType];
  if (!def) return { ok: false, error: "Entity Life OS tidak didukung oleh fallback CRUD." };
  const queryLimit = Math.min(50, Math.max(1, Number(args.limit) || 20));

  if (operation === "read") {
    let query: any = ctx.supabase.from(def.table).select("*").eq("user_id", ctx.userId);
    const filters = sanitizeAiCrudFilters(entityType, args.filters);
    for (const [key, value] of Object.entries(filters)) {
      if (value === null) query = query.is(key, null);
      else query = query.eq(key, value);
    }
    query = query.order(def.sort || "created_at", { ascending: false }).limit(queryLimit);
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, entity_type: entityType, operation, count: data?.length ?? 0, items: data ?? [] };
  }

  if (def.readOnly) return { ok: false, error: `Entity ${entityType} hanya dapat dibaca oleh fallback CRUD.` };

  if (operation === "create") {
    const data = sanitizeAiCrudData(entityType, args.data);
    if (!Object.keys(data).length) return { ok: false, error: "Tidak ada field valid untuk dibuat." };
    const { data: row, error } = await ctx.supabase
      .from(def.table)
      .insert({ user_id: ctx.userId, ...data })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, entity_type: entityType, operation, created: row };
  }

  if (!args.entity_id) return { ok: false, error: "entity_id wajib untuk update/delete." };
  if (!isUuid(args.entity_id))
    return {
      ok: false,
      code: "INVALID_ENTITY_ID",
      error: "entity_id harus berupa UUID nyata dari hasil baca/search, bukan nomor urut seperti 1, 2, atau 3.",
    };

  if (operation === "update") {
    const data = sanitizeAiCrudData(entityType, args.data);
    if (!Object.keys(data).length) return { ok: false, error: "Tidak ada field valid untuk diubah." };
    const { data: row, error } = await ctx.supabase
      .from(def.table)
      .update(data)
      .eq("id", args.entity_id)
      .eq("user_id", ctx.userId)
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, entity_type: entityType, operation, updated: row };
  }

  if (operation === "delete") {
    if (args.confirm !== true)
      return {
        ok: false,
        status: "confirmation_required",
        code: "AI_CRUD_DELETE_CONFIRM",
        error: "Penghapusan melalui fallback CRUD membutuhkan confirm=true setelah target terverifikasi.",
      };
    const { data: row, error } = await ctx.supabase
      .from(def.table)
      .delete()
      .eq("id", args.entity_id)
      .eq("user_id", ctx.userId)
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!row) return { ok: false, status: "not_found", error: "Target tidak ditemukan." };
    return { ok: true, entity_type: entityType, operation, deleted: row };
  }

  return { ok: false, error: "Operasi CRUD tidak dikenal." };
}

async function createTaskFromInbox(ctx: HandlerCtx, args: any) {
  const inboxId = String(args.inbox_id || "").trim();
  const { data: item, error: inboxError } = await ctx.supabase
    .from("smart_inbox_items")
    .select("id,content,status,linked_task_id,kind")
    .eq("id", inboxId)
    .eq("user_id", ctx.userId)
    .single();
  if (inboxError || !item) return { ok: false, error: "Item Inbox tidak ditemukan." };
  if (item.linked_task_id)
    return {
      ok: false,
      status: "already_linked",
      task_id: item.linked_task_id,
      message: "Item Inbox ini sudah terhubung ke tugas.",
    };
  const title = String(args.title || item.content)
    .trim()
    .slice(0, 180);
  const dueAt = ensureTimezoneOffset(args.due_at, ctx.timezone);
  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title,
      description: String(item.content || "").trim(),
      status: "todo",
      priority: args.priority || "medium",
      due_at: dueAt,
    })
    .select()
    .single();
  if (error || !task) return { ok: false, error: error?.message || "Tugas gagal dibuat." };
  let reminder = null;
  if (dueAt) {
    const mins = await getDefaultReminderMinutes(ctx.supabase, ctx.userId);
    if (mins > 0) reminder = await createDefaultTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, task, mins);
  }
  const { error: linkError } = await ctx.supabase
    .from("smart_inbox_items")
    .update({ linked_task_id: task.id, status: "processed", processed_at: new Date().toISOString() })
    .eq("id", inboxId)
    .eq("user_id", ctx.userId);
  if (linkError) {
    await ctx.supabase.from("tasks").delete().eq("id", task.id).eq("user_id", ctx.userId);
    return { ok: false, error: linkError.message };
  }
  return { ok: true, task, inbox: item, linked: true, reminder };
}

async function createTaskFromNote(ctx: HandlerCtx, args: any) {
  const noteId = String(args.note_id || "").trim();
  const { data: note, error: noteError } = await ctx.supabase
    .from("brain_dump_notes")
    .select("id,content,tags,created_at")
    .eq("id", noteId)
    .eq("user_id", ctx.userId)
    .single();
  if (noteError || !note) return { ok: false, error: "Catatan tidak ditemukan." };
  const content = String(note.content || "").trim();
  const title = String(args.title || content.split(/[.!?\n]/)[0] || "Tugas dari catatan")
    .trim()
    .slice(0, 180);
  const desc = [content, note.tags?.length ? `Tag: ${note.tags.join(", ")}` : null, `Sumber: catatan ${note.id}`]
    .filter(Boolean)
    .join("\n");
  const dueAt = ensureTimezoneOffset(args.due_at, ctx.timezone);
  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title,
      description: desc || null,
      status: "todo",
      priority: args.priority || "medium",
      due_at: dueAt,
    })
    .select()
    .single();
  if (error || !task) return { ok: false, error: error?.message || "Tugas gagal dibuat." };
  let reminder = null;
  if (dueAt) {
    const mins = await getDefaultReminderMinutes(ctx.supabase, ctx.userId);
    if (mins > 0) reminder = await createDefaultTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, task, mins);
  }
  return { ok: true, task, note, linked: false, source: "note", reminder };
}

async function createScheduleFromTask(ctx: HandlerCtx, args: any) {
  const { data: task, error: taskError } = await ctx.supabase
    .from("tasks")
    .select("id,title,description,estimated_minutes,project_id")
    .eq("id", args.task_id)
    .eq("user_id", ctx.userId)
    .single();
  if (taskError || !task) return { ok: false, error: "Tugas tidak ditemukan." };
  const blockDate = String(args.block_date || "");
  const start = String(args.start_time || "");
  const end = String(args.end_time || "");
  if (!blockDate || !start || !end) return { ok: false, error: "Tanggal, jam mulai, dan jam selesai wajib diisi." };
  const { data: block, error } = await ctx.supabase
    .from("schedule_blocks")
    .insert({
      user_id: ctx.userId,
      block_date: blockDate,
      start_time: start,
      end_time: end,
      title: String(args.title || task.title).trim(),
      location: args.location || null,
      description: args.description || task.description || null,
      task_id: task.id,
      project_id: task.project_id || null,
      created_by: "ai",
    })
    .select()
    .single();
  if (error || !block) return { ok: false, error: error?.message || "Agenda gagal dibuat." };
  const { data: profile } = await ctx.supabase.from("users").select("preferences").eq("id", ctx.userId).maybeSingle();
  const defaultMinutes = Math.min(
    1440,
    Math.max(0, Number((profile?.preferences as any)?.defaultReminderMinutes) || 0),
  );
  let reminder = null;
  if (defaultMinutes > 0) {
    const startIso = ensureTimezoneOffset(`${block.block_date}T${String(block.start_time).slice(0, 8)}`, ctx.timezone);
    const remindMs = startIso ? new Date(startIso).getTime() - defaultMinutes * 60_000 : NaN;
    if (Number.isFinite(remindMs) && remindMs > Date.now()) {
      const { data: reminderData } = await ctx.supabase
        .from("reminders")
        .insert({
          user_id: ctx.userId,
          title: `Pengingat: ${block.title}`,
          body: `${String(block.start_time).slice(0, 5)}–${String(block.end_time).slice(0, 5)}`,
          remind_at: new Date(remindMs).toISOString(),
          timezone: ctx.timezone,
          target_type: "schedule",
          target_id: block.id,
          offset_minutes: defaultMinutes,
          href: "/calendar",
          enabled: true,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .select("id,title,remind_at,target_id")
        .maybeSingle();
      reminder = reminderData;
    }
  }
  return { ok: true, block, task, linked: true, reminder };
}

async function createReminder(ctx: HandlerCtx, args: any) {
  const title = String(args.title || "Pengingat Licia")
    .trim()
    .slice(0, 180);
  const remindAt = ensureTimezoneOffset(String(args.remind_at || ""), ctx.timezone);
  const ms = remindAt ? new Date(remindAt).getTime() : NaN;
  if (!title || !remindAt || !Number.isFinite(ms))
    return { ok: false, error: "Judul dan waktu pengingat harus valid." };
  if (ms < Date.now() - 60_000) return { ok: false, error: "Waktu pengingat sudah lewat. Gunakan waktu mendatang." };
  const { data: reminder, error } = await ctx.supabase
    .from("reminders")
    .insert({
      user_id: ctx.userId,
      title,
      body: args.body ? String(args.body).trim().slice(0, 1000) : null,
      remind_at: remindAt,
      timezone: ctx.timezone,
      target_type: args.target_type || "custom",
      target_id: args.target_id || null,
      href: args.href ? String(args.href).trim().slice(0, 300) : "/reminders",
      offset_minutes: Number.isFinite(Number(args.offset_minutes))
        ? Math.max(1, Math.min(1440, Number(args.offset_minutes)))
        : null,
      enabled: args.enabled !== false,
      status: args.enabled === false ? "cancelled" : "pending",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error || !reminder) return { ok: false, error: error?.message || "Pengingat gagal dibuat." };
  return {
    ok: true,
    reminder: {
      ...reminder,
      remind_at_local: formatDateTimeInTimezone(reminder.remind_at, ctx.timezone),
      timezone_label: ctx.timezone,
    },
  };
}

async function getReminders(ctx: HandlerCtx, args: any) {
  const status = String(args.status || "pending");
  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
  let query = ctx.supabase
    .from("reminders")
    .select(
      "id,title,body,remind_at,timezone,target_type,target_id,offset_minutes,enabled,status,last_attempt_at,sent_at,created_at,updated_at",
    )
    .eq("user_id", ctx.userId)
    .order("remind_at", { ascending: true })
    .limit(limit);
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, reminders: data || [] };
}

async function updateReminder(ctx: HandlerCtx, args: any) {
  const id = String(args.reminder_id || "").trim();
  if (!id) return { ok: false, error: "reminder_id wajib diisi." };
  const { data: current, error: currentError } = await ctx.supabase
    .from("reminders")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (currentError || !current) return { ok: false, error: "Pengingat tidak ditemukan." };
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (args.title !== undefined) patch.title = String(args.title).trim().slice(0, 180);
  if (args.body !== undefined) patch.body = String(args.body).trim().slice(0, 1000) || null;
  if (args.href !== undefined) patch.href = String(args.href).trim().slice(0, 300) || "/reminders";
  if (args.remind_at !== undefined) {
    const normalized = ensureTimezoneOffset(String(args.remind_at), ctx.timezone);
    const ms = normalized ? new Date(normalized).getTime() : NaN;
    if (!normalized || !Number.isFinite(ms)) return { ok: false, error: "Waktu pengingat tidak valid." };
    if (ms < Date.now() - 60_000) return { ok: false, error: "Waktu pengingat sudah lewat." };
    patch.remind_at = normalized;
    patch.status = "pending";
    patch.sent_at = null;
  }
  if (args.enabled !== undefined) {
    patch.enabled = Boolean(args.enabled);
    patch.status = args.enabled ? "pending" : "cancelled";
  }
  const { data, error } = await ctx.supabase
    .from("reminders")
    .update(patch)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Pengingat gagal diperbarui." };
  return {
    ok: true,
    reminder: {
      ...data,
      remind_at_local: formatDateTimeInTimezone(data.remind_at, ctx.timezone),
      timezone_label: ctx.timezone,
    },
    before: current,
  };
}

async function deleteReminder(ctx: HandlerCtx, args: any) {
  const confirmId = String(args.confirm_reminder_id || "").trim();
  if (confirmId) {
    const { data, error } = await ctx.supabase
      .from("reminders")
      .delete()
      .eq("id", confirmId)
      .eq("user_id", ctx.userId)
      .select()
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Pengingat tidak ditemukan atau sudah dihapus." };
    await emitLifeEvent(ctx.supabase, {
      userId: ctx.userId,
      eventType: "reminder.cancelled",
      entityType: "reminder",
      entityId: data.id,
      payload: { reason: "reminder_deleted" },
    });
    return { ok: true, deleted: data };
  }
  const keyword = String(args.keyword || "").trim();
  let query = ctx.supabase
    .from("reminders")
    .select("id,title,body,remind_at,status")
    .eq("user_id", ctx.userId)
    .in("status", ["pending", "waiting_for_device", "failed"])
    .order("remind_at", { ascending: true })
    .limit(8);
  if (keyword) {
    const safe = keyword.replace(/[%_]/g, "\\$&");
    query = query.ilike("title", `%${safe}%`);
  }
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, status: "not_found", message: "Pengingat tidak ditemukan." };
  if (data.length > 1) return { ok: false, status: "multiple_candidates", candidates: data };
  return { ok: false, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function deleteAllReminders(ctx: HandlerCtx, args: any) {
  const { count, error: countError } = await ctx.supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId);
  if (countError) return { ok: false, error: countError.message };

  const total = Number(count ?? 0);
  if (args.confirm !== true) {
    const { data: previewRows, error: previewError } = await ctx.supabase
      .from("reminders")
      .select("id,title,remind_at,status,target_type")
      .eq("user_id", ctx.userId)
      .order("remind_at", { ascending: true })
      .limit(12);
    if (previewError) return { ok: false, error: previewError.message };
    return {
      ok: true,
      status: "confirmation_required",
      code: "REMINDER_DELETE_CONFIRM",
      count: total,
      reminders: previewRows ?? [],
      message: total ? `Ada ${total} pengingat yang akan dihapus.` : "Tidak ada pengingat untuk dihapus.",
    };
  }

  if (!total) return { ok: true, status: "no_changes", deleted: 0, message: "Tidak ada pengingat untuk dihapus." };

  const { data: deletedRows, error } = await ctx.supabase
    .from("reminders")
    .delete()
    .eq("user_id", ctx.userId)
    .select("id,title,remind_at,status,target_type,target_id");
  if (error) return { ok: false, error: error.message, retryable: true };

  const deleted = deletedRows?.length ?? 0;
  for (const row of deletedRows ?? []) {
    await emitLifeEvent(ctx.supabase, {
      userId: ctx.userId,
      eventType: "reminder.cancelled",
      entityType: "reminder",
      entityId: row.id,
      payload: { reason: "all_reminders_deleted" },
    });
  }
  if (deleted !== total) {
    return {
      ok: false,
      error: `Penghapusan hanya menghapus ${deleted} dari ${total} pengingat.`,
      deleted,
      expected: total,
      retryable: true,
    };
  }
  return { ok: true, deleted, expected: total, message: `${deleted} pengingat berhasil dihapus.` };
}

async function createScheduleReminder(ctx: HandlerCtx, args: any) {
  const blockId = String(args.schedule_block_id || "").trim();
  const { data: block, error: blockError } = await ctx.supabase
    .from("schedule_blocks")
    .select("id,title,block_date,start_time,end_time")
    .eq("id", blockId)
    .eq("user_id", ctx.userId)
    .single();
  if (blockError || !block) return { ok: false, error: "Agenda tidak ditemukan." };
  const minutes = Math.min(1440, Math.max(1, Number(args.minutes_before) || 30));
  const startIso = ensureTimezoneOffset(`${block.block_date}T${String(block.start_time).slice(0, 8)}`, ctx.timezone);
  if (!startIso) return { ok: false, error: "Waktu agenda tidak valid." };
  const remindMs = new Date(startIso).getTime() - minutes * 60_000;
  if (!Number.isFinite(remindMs)) return { ok: false, error: "Waktu agenda tidak valid." };
  if (remindMs <= Date.now())
    return { ok: false, error: "Waktu pengingat sudah lewat. Pilih pengingat yang masih berada di masa depan." };
  const remindAt = new Date(remindMs).toISOString();
  const name = String(args.name || `Pengingat: ${block.title}`)
    .trim()
    .slice(0, 120);
  const { data: existing } = await ctx.supabase
    .from("reminders")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("target_type", "schedule")
    .eq("target_id", block.id)
    .eq("enabled", true)
    .limit(1);
  let reminder: any = null;
  if (existing?.[0]) {
    const { data, error } = await ctx.supabase
      .from("reminders")
      .update({
        title: name,
        body: `${block.title} · ${String(block.start_time).slice(0, 5)}–${String(block.end_time).slice(0, 5)}`,
        remind_at: remindAt,
        offset_minutes: minutes,
        status: "pending",
        sent_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing[0].id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message || "Pengingat gagal diperbarui." };
    reminder = data;
  } else {
    const { data, error } = await ctx.supabase
      .from("reminders")
      .insert({
        user_id: ctx.userId,
        title: name,
        body: `${block.title} · ${String(block.start_time).slice(0, 5)}–${String(block.end_time).slice(0, 5)}`,
        remind_at: remindAt,
        timezone: ctx.timezone,
        target_type: "schedule",
        target_id: block.id,
        offset_minutes: minutes,
        enabled: args.enabled !== false,
        status: args.enabled === false ? "cancelled" : "pending",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message || "Pengingat gagal dibuat." };
    reminder = data;
  }
  // Keep the legacy Automation Center rule in sync for users who still manage
  // agenda reminders from that page. Dispatch itself uses reminders as source of truth.
  const { data: existingRule } = await ctx.supabase
    .from("automations")
    .select("id,trigger_config")
    .eq("user_id", ctx.userId)
    .eq("trigger_type", "schedule_soon")
    .contains("trigger_config", { schedule_block_id: block.id })
    .limit(1);
  if (existingRule?.[0]) {
    await ctx.supabase
      .from("automations")
      .update({
        name,
        trigger_config: { schedule_block_id: block.id, minutes },
        action_type: "notify",
        action_config: {},
        enabled: args.enabled !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingRule[0].id)
      .eq("user_id", ctx.userId);
  } else {
    await ctx.supabase
      .from("automations")
      .insert({
        user_id: ctx.userId,
        name,
        trigger_type: "schedule_soon",
        trigger_config: { schedule_block_id: block.id, minutes },
        action_type: "notify",
        action_config: {},
        enabled: args.enabled !== false,
      });
  }
  return {
    ok: true,
    reminder: reminder
      ? {
          ...reminder,
          remind_at_local: formatDateTimeInTimezone(reminder.remind_at, ctx.timezone),
          timezone_label: ctx.timezone,
        }
      : null,
    schedule: block,
    minutes_before: minutes,
  };
}

async function createTaskFromProject(ctx: HandlerCtx, args: any) {
  const projectId = String(args.project_id || "").trim();
  if (!projectId) return { ok: false, error: "project_id wajib diisi." };
  const { data: project, error: projectError } = await ctx.supabase
    .from("projects")
    .select("id,name,status,target_date,goal_id,description")
    .eq("id", projectId)
    .eq("user_id", ctx.userId)
    .single();
  if (projectError || !project) return { ok: false, error: "Project tidak ditemukan." };
  const title = String(args.title || `Langkah berikutnya: ${project.name}`)
    .trim()
    .slice(0, 180);
  const description = String(
    args.description ||
      `Task dari project ${project.name}.
${project.description || ""}`,
  ).trim();
  const dueAt = ensureTimezoneOffset(args.due_at, ctx.timezone);
  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title,
      description: description || null,
      status: "todo",
      priority: args.priority || "medium",
      due_at: dueAt,
      project_id: project.id,
    })
    .select()
    .single();
  if (error || !task) return { ok: false, error: error?.message || "Tugas gagal dibuat." };
  let reminder = null;
  if (dueAt) {
    const mins = await getDefaultReminderMinutes(ctx.supabase, ctx.userId);
    if (mins > 0) reminder = await createDefaultTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, task, mins);
  }
  return { ok: true, task, project, linked: true, reminder };
}

async function createTaskFromGoal(ctx: HandlerCtx, args: any) {
  const goalId = String(args.goal_id || "").trim();
  if (!goalId) return { ok: false, error: "goal_id wajib diisi." };
  const { data: goal, error: goalError } = await ctx.supabase
    .from("goals")
    .select("id,title,status,progress,target_date,next_step,description")
    .eq("id", goalId)
    .eq("user_id", ctx.userId)
    .single();
  if (goalError || !goal) return { ok: false, error: "Target tidak ditemukan." };
  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id,name,status")
    .eq("user_id", ctx.userId)
    .eq("goal_id", goal.id)
    .in("status", ["active", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const title = String(args.title || goal.next_step || `Langkah menuju target: ${goal.title}`)
    .trim()
    .slice(0, 180);
  const description = String(
    args.description ||
      [
        `Target: ${goal.title}`,
        goal.description || null,
        goal.next_step ? `Langkah berikutnya: ${goal.next_step}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
  ).trim();
  const defaultDue = goal.target_date ? `${goal.target_date}T23:59:00` : undefined;
  const dueAt = ensureTimezoneOffset(args.due_at || defaultDue, ctx.timezone);
  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title,
      description: description || null,
      status: "todo",
      priority: args.priority || "medium",
      due_at: dueAt,
      project_id: project?.id || null,
    })
    .select()
    .single();
  if (error || !task) return { ok: false, error: error?.message || "Tugas gagal dibuat." };
  let reminder = null;
  if (dueAt) {
    const mins = await getDefaultReminderMinutes(ctx.supabase, ctx.userId);
    if (mins > 0) reminder = await createDefaultTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, task, mins);
  }
  return { ok: true, task, goal, project: project || null, linked: Boolean(project?.id), reminder };
}

async function createTaskWithSubtasks(ctx: HandlerCtx, args: any) {
  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title: args.title,
      description: args.description ?? null,
      due_at: ensureTimezoneOffset(args.due_at, ctx.timezone),
      priority: args.priority ?? "medium",
      status: "todo",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  if (args.subtasks?.length) {
    const rows = args.subtasks.map((title: string) => ({
      user_id: ctx.userId,
      task_id: task.id,
      title,
      status: "todo",
    }));
    const { error: subError } = await ctx.supabase.from("subtasks").insert(rows);
    if (subError) return { ok: true, task, subtask_error: subError.message };
  }
  let reminder = null;
  if (task.due_at) {
    const mins = await getDefaultReminderMinutes(ctx.supabase, ctx.userId);
    if (mins > 0) reminder = await createDefaultTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, task, mins);
  }

  return { ok: true, task, subtasks_created: args.subtasks?.length ?? 0, reminder };
}

async function getTasks(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("tasks")
    .select("id, title, status, priority, due_at, subtasks(id, title, status)")
    .eq("user_id", ctx.userId);

  if (args.status && args.status !== "all") {
    query = query.eq("status", args.status);
  } else if (!args.status) {
    query = query.neq("status", "done");
  }
  if (args.due_before) query = query.lte("due_at", args.due_before);
  if (args.keyword) query = query.ilike("title", `%${args.keyword}%`);

  const { data, error } = await query.order("due_at", { ascending: true, nullsFirst: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: data?.length ?? 0, tasks: data };
}

async function updateTask(ctx: HandlerCtx, args: any) {
  if (args.subtask_id) {
    const { data, error } = await ctx.supabase
      .from("subtasks")
      .update({ status: args.subtask_status ?? "done" })
      .eq("id", args.subtask_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, subtask: data };
  }

  if (!args.task_id) return { ok: false, error: "task_id wajib diisi kalau bukan update subtugas." };
  if (!isUuid(String(args.task_id)))
    return {
      ok: false,
      code: "INVALID_ENTITY_ID",
      error: "task_id harus berupa UUID nyata dari hasil baca/search, bukan nomor urut seperti 1, 2, atau 3.",
      retryable: false,
    };

  const patch: Record<string, any> = {};
  if (args.status) patch.status = args.status;
  if (args.title) patch.title = args.title;
  if (args.description !== undefined) patch.description = args.description;
  if (args.priority) patch.priority = args.priority;
  if (args.due_at !== undefined)
    patch.due_at = args.due_at ? ensureTimezoneOffset(String(args.due_at), ctx.timezone) : null;
  if (!Object.keys(patch).length)
    return { ok: false, status: "no_changes", error: "Tidak ada perubahan task yang diberikan." };
  patch.updated_at = new Date().toISOString();

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(patch)
    .eq("id", args.task_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  let reminder = null;
  if (data?.status === "done" || data?.due_at === null) {
    await cancelTaskReminders(
      ctx.supabase,
      ctx.userId,
      [data.id],
      data.status === "done" ? "task_completed" : "task_deadline_removed",
    );
  } else if (data?.due_at) {
    reminder = await syncExistingTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, data);
    if (!reminder) {
      const mins = await getDefaultReminderMinutes(ctx.supabase, ctx.userId);
      if (mins > 0) reminder = await createDefaultTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, data, mins);
    }
  }
  await emitLifeEvent(ctx.supabase, {
    userId: ctx.userId,
    eventType: "task.updated",
    entityType: "task",
    entityId: data.id,
    payload: { status: data.status, due_at: data.due_at },
  });
  return { ok: true, task: data, reminder };
}

async function updateTasksBulk(ctx: HandlerCtx, args: any) {
  const rawIds = Array.isArray(args.task_ids)
    ? args.task_ids
        .map(String)
        .map((x: string) => x.trim())
        .filter(Boolean)
    : [];
  const invalidIds = rawIds.filter((id: string) => !isUuid(id));
  if (invalidIds.length)
    return {
      ok: false,
      code: "INVALID_ENTITY_ID",
      error: "Semua task_ids harus berupa UUID nyata dari hasil baca/search.",
    };
  let ids = [...new Set(rawIds)].slice(0, 30);

  if (!ids.length) {
    let targetQuery = ctx.supabase.from("tasks").select("id").eq("user_id", ctx.userId);
    if (typeof args.keyword === "string" && args.keyword.trim()) {
      targetQuery = targetQuery.ilike("title", `%${args.keyword.trim()}%`);
    }
    if (typeof args.due_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.due_on)) {
      const day = new Date(`${args.due_on}T12:00:00Z`);
      targetQuery = targetQuery
        .gte("due_at", startOfDayIsoForTimezone(day, ctx.timezone))
        .lte("due_at", endOfDayIsoForTimezone(day, ctx.timezone));
    }
    if (typeof args.due_from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.due_from)) {
      const from = new Date(`${args.due_from}T12:00:00Z`);
      targetQuery = targetQuery.gte("due_at", startOfDayIsoForTimezone(from, ctx.timezone));
    }
    if (typeof args.due_to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.due_to)) {
      const to = new Date(`${args.due_to}T12:00:00Z`);
      targetQuery = targetQuery.lte("due_at", endOfDayIsoForTimezone(to, ctx.timezone));
    }
    if (typeof args.due_after === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.due_after)) {
      const after = new Date(`${args.due_after}T12:00:00Z`);
      targetQuery = targetQuery.gt("due_at", endOfDayIsoForTimezone(after, ctx.timezone));
    }
    if (!args.keyword && !args.due_on && !args.due_from && !args.due_to && !args.due_after) {
      return {
        ok: false,
        status: "no_scope",
        error: "Update bulk membutuhkan target eksplisit: task_ids, keyword, atau scope tanggal.",
      };
    }
    const { data, error } = await targetQuery.order("due_at", { ascending: true, nullsFirst: false }).limit(30);
    if (error) return { ok: false, error: error.message };
    ids = (data ?? [])
      .map((row: any) => String(row.id))
      .filter(isUuid)
      .slice(0, 30);
  }

  if (!ids.length)
    return { ok: false, status: "no_match", error: "Tidak ada target tugas yang cocok dengan scope yang diminta." };

  const { data: existingTargets, error: targetError } = await ctx.supabase
    .from("tasks")
    .select("id,title,status,priority,due_at")
    .eq("user_id", ctx.userId)
    .in("id", ids);
  if (targetError) return { ok: false, error: targetError.message };
  if ((existingTargets ?? []).length !== ids.length) {
    const found = new Set((existingTargets ?? []).map((row: any) => String(row.id)));
    return {
      ok: false,
      status: "target_changed",
      requested_count: ids.length,
      found_count: found.size,
      missing_ids: ids.filter((id) => !found.has(String(id))),
      error: "Sebagian target tugas sudah tidak tersedia. Tidak ada perubahan yang diterapkan.",
    };
  }

  const targetDateMatches = (value: unknown, startIso?: string, endIso?: string) => {
    if (!value) return false;
    const timestamp = new Date(String(value)).getTime();
    if (!Number.isFinite(timestamp)) return false;
    if (startIso && timestamp < new Date(startIso).getTime()) return false;
    if (endIso && timestamp > new Date(endIso).getTime()) return false;
    return true;
  };
  const scopedTargets =
    args.due_on || args.due_from || args.due_to || args.due_after
      ? (existingTargets ?? []).filter((row: any) => {
          if (args.due_on) {
            const day = new Date(`${args.due_on}T12:00:00Z`);
            return targetDateMatches(
              row.due_at,
              startOfDayIsoForTimezone(day, ctx.timezone),
              endOfDayIsoForTimezone(day, ctx.timezone),
            );
          }
          if (args.due_after) {
            const after = new Date(`${args.due_after}T12:00:00Z`);
            return (
              targetDateMatches(row.due_at, endOfDayIsoForTimezone(after, ctx.timezone), undefined) &&
              new Date(String(row.due_at)).getTime() > new Date(endOfDayIsoForTimezone(after, ctx.timezone)).getTime()
            );
          }
          const from = args.due_from
            ? startOfDayIsoForTimezone(new Date(`${args.due_from}T12:00:00Z`), ctx.timezone)
            : undefined;
          const to = args.due_to
            ? endOfDayIsoForTimezone(new Date(`${args.due_to}T12:00:00Z`), ctx.timezone)
            : undefined;
          return targetDateMatches(row.due_at, from, to);
        })
      : (existingTargets ?? []);
  ids = scopedTargets.map((row: any) => String(row.id)).filter(isUuid);
  if (!ids.length)
    return {
      ok: false,
      status: "scope_no_match",
      error: "Target yang diberikan tidak termasuk scope tanggal yang diminta. Tidak ada perubahan yang diterapkan.",
    };

  const patch: Record<string, any> = {};
  if (args.status) patch.status = args.status;
  if (args.priority) patch.priority = args.priority;
  if (args.due_at !== undefined)
    patch.due_at = args.due_at ? ensureTimezoneOffset(String(args.due_at), ctx.timezone) : null;
  if (!Object.keys(patch).length)
    return { ok: false, status: "no_changes", error: "Tidak ada perubahan yang diberikan." };
  patch.updated_at = new Date().toISOString();

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(patch)
    .in("id", ids)
    .eq("user_id", ctx.userId)
    .select("id,title,status,priority,due_at,description,estimated_minutes,project_id,created_at,updated_at");
  if (error) return { ok: false, error: error.message };

  const updated = data ?? [];
  if (updated.length) {
    const updatedIds = updated.map((row: any) => row.id);
    if (patch.status === "done" || patch.due_at === null) {
      await cancelTaskReminders(
        ctx.supabase,
        ctx.userId,
        updatedIds,
        patch.status === "done" ? "task_bulk_completed" : "task_deadline_removed",
      );
    } else if (patch.due_at !== undefined) {
      for (const row of updated) {
        const reminder = await syncExistingTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, row);
        if (!reminder) {
          const mins = await getDefaultReminderMinutes(ctx.supabase, ctx.userId);
          if (mins > 0) await createDefaultTaskReminder(ctx.supabase, ctx.userId, ctx.timezone, row, mins);
        }
      }
    }
    for (const row of updated) {
      await emitLifeEvent(ctx.supabase, {
        userId: ctx.userId,
        eventType: "task.updated",
        entityType: "task",
        entityId: row.id,
        payload: { status: row.status, due_at: row.due_at, bulk: true },
      });
    }
  }
  return {
    ok: true,
    operation: "bulk_update",
    count: updated.length,
    requested_count: ids.length,
    updated,
    requested_ids: ids,
  };
}

async function deleteSubtask(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("subtasks")
    .delete()
    .eq("id", args.subtask_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, deleted: data };
}

async function deleteTask(ctx: HandlerCtx, args: any) {
  if (args.confirm_task_id) {
    const { data, error } = await ctx.supabase
      .from("tasks")
      .delete()
      .eq("id", args.confirm_task_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await cancelTaskReminders(ctx.supabase, ctx.userId, [String(data.id)], "task_deleted");
    await emitLifeEvent(ctx.supabase, {
      userId: ctx.userId,
      eventType: "task.deleted",
      entityType: "task",
      entityId: data.id,
      payload: { title: data.title },
    });
    return { ok: true, deleted: data };
  }

  let query = ctx.supabase.from("tasks").select("id, title, status, due_at").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("title", `%${args.keyword}%`);

  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };

  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada tugas yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function deleteTasksBulk(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("tasks")
    .select("id,title,status,priority,due_at,description,estimated_minutes,project_id,created_at,updated_at")
    .eq("user_id", ctx.userId);
  const status = typeof args.status === "string" ? args.status : "all";
  if (["todo", "in_progress", "done"].includes(status)) query = query.eq("status", status);
  if (typeof args.keyword === "string" && args.keyword.trim()) query = query.ilike("title", `%${args.keyword.trim()}%`);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  if (!rows.length) return { ok: true, status: "no_match", count: 0, deleted: [] };
  const ids = rows.map((row) => row.id).filter(Boolean);
  const { data: deleted, error: deleteError } = await ctx.supabase
    .from("tasks")
    .delete()
    .in("id", ids)
    .eq("user_id", ctx.userId)
    .select("id,title,status,priority,due_at,project_id");
  if (deleteError) return { ok: false, error: deleteError.message };
  await cancelTaskReminders(ctx.supabase, ctx.userId, ids, "task_bulk_deleted");
  for (const row of deleted ?? [])
    await emitLifeEvent(ctx.supabase, {
      userId: ctx.userId,
      eventType: "task.deleted",
      entityType: "task",
      entityId: row.id,
      payload: { title: row.title, bulk: true },
    });
  return {
    ok: true,
    operation: "bulk_delete",
    count: deleted?.length ?? ids.length,
    deleted: deleted ?? [],
    requested: { status, keyword: typeof args.keyword === "string" ? args.keyword.trim() || null : null },
  };
}

async function logPomodoro(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("pomodoro_sessions")
    .insert({
      user_id: ctx.userId,
      focus_minutes: args.focus_minutes,
      task_id: args.task_id ?? null,
      started_at: new Date().toISOString(),
      completed: true,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, session: data };
}

async function getPomodoroSessions(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("pomodoro_sessions")
    .select("id, focus_minutes, started_at, task_id")
    .eq("user_id", ctx.userId)
    .gte("started_at", args.from_date)
    .lte("started_at", `${args.to_date}T23:59:59`)
    .order("started_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  const totalMinutes = (data ?? []).reduce((s, p) => s + Number(p.focus_minutes), 0);
  return { ok: true, total_minutes: totalMinutes, count: data?.length ?? 0, sessions: data };
}

async function deletePomodoroSession(ctx: HandlerCtx, args: any) {
  if (args.confirm_session_id) {
    const { data, error } = await ctx.supabase
      .from("pomodoro_sessions")
      .delete()
      .eq("id", args.confirm_session_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }

  let query = ctx.supabase.from("pomodoro_sessions").select("id, focus_minutes, started_at").eq("user_id", ctx.userId);
  if (args.from_date) query = query.gte("started_at", args.from_date);
  if (args.to_date) query = query.lte("started_at", `${args.to_date}T23:59:59`);

  const { data, error } = await query.order("started_at", { ascending: false }).limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: true, status: "no_match", message: "Tidak ada sesi pomodoro yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function createDailySchedule(ctx: HandlerCtx, args: any) {
  const rawBlocks = Array.isArray(args.blocks) ? args.blocks : [];
  if (!rawBlocks.length) return { ok: false, error: "Tidak ada blok jadwal yang diberikan." };

  const blockErrors: Array<{ index: number; error: string; block: any }> = [];
  const createdBlocks: any[] = [];

  const insertBlock = async (block: any) => {
    const blockDate = String(block?.block_date || "").trim();
    const startTime = String(block?.start_time || "")
      .trim()
      .slice(0, 8);
    const endTime = String(block?.end_time || "")
      .trim()
      .slice(0, 8);
    const title = String(block?.title || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate))
      return { ok: false, error: "Tanggal agenda harus berupa YYYY-MM-DD yang jelas." };
    const parsedDate = new Date(`${blockDate}T00:00:00Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== blockDate)
      return { ok: false, error: "Tanggal agenda tidak valid." };
    const sourceWeekday = String(block?.weekday || "")
      .trim()
      .toLowerCase();
    if (sourceWeekday) {
      const weekdayNames = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
      const actualWeekday = weekdayNames[parsedDate.getUTCDay()];
      const normalizedWeekday = sourceWeekday.replace("jum'at", "jumat");
      if (!weekdayNames.includes(normalizedWeekday) || actualWeekday !== normalizedWeekday) {
        return {
          ok: false,
          error: `Hari tidak cocok dengan tanggal ${blockDate}. Tanggal tersebut adalah ${actualWeekday}.`,
        };
      }
    }
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(startTime) || !/^\d{2}:\d{2}(:\d{2})?$/.test(endTime))
      return { ok: false, error: "Jam mulai dan selesai harus dalam format HH:MM." };
    if (!title) return { ok: false, error: "Judul agenda wajib diisi." };
    if (startTime >= endTime) return { ok: false, error: "Jam selesai harus lebih besar daripada jam mulai." };

    const fullPayload = {
      user_id: ctx.userId,
      block_date: blockDate,
      start_time: startTime,
      end_time: endTime,
      title,
      location: block?.location ?? null,
      description: block?.description ?? null,
      task_id: block?.task_id ?? null,
      created_by: "ai",
    };
    const minimalPayload = {
      user_id: ctx.userId,
      block_date: blockDate,
      start_time: startTime,
      end_time: endTime,
      title,
      created_by: "ai",
    };

    let inserted = await ctx.supabase.from("schedule_blocks").insert(fullPayload).select("*").single();
    if (inserted.error) {
      const detail = `${inserted.error.code || ""} ${inserted.error.message || ""}`.toLowerCase();
      const optionalColumnsMissing =
        /column .*?(location|description|task_id).*?(does not exist|schema cache)|could not find the .*?(location|description|task_id).*?column/.test(
          detail,
        );
      if (optionalColumnsMissing) {
        inserted = await ctx.supabase.from("schedule_blocks").insert(minimalPayload).select("*").single();
      }
    }
    if (inserted.error || !inserted.data)
      return { ok: false, error: inserted.error?.message || "Agenda gagal dibuat." };
    return { ok: true, block: inserted.data };
  };

  for (let i = 0; i < rawBlocks.slice(0, 20).length; i++) {
    const result = await insertBlock(rawBlocks[i]);
    if (result.ok) createdBlocks.push(result.block);
    else blockErrors.push({ index: i, error: result.error ?? "Agenda gagal dibuat.", block: rawBlocks[i] });
  }

  const { data: profile } = await ctx.supabase.from("users").select("preferences").eq("id", ctx.userId).maybeSingle();
  const defaultMinutes = Math.min(
    1440,
    Math.max(0, Number((profile?.preferences as any)?.defaultReminderMinutes) || 0),
  );
  const autoReminders: any[] = [];
  const reminderErrors: Array<{ block_id: string; error: string }> = [];
  if (defaultMinutes > 0) {
    for (const block of createdBlocks) {
      const startIso = ensureTimezoneOffset(
        `${block.block_date}T${String(block.start_time).slice(0, 8)}`,
        ctx.timezone,
      );
      const remindMs = startIso ? new Date(startIso).getTime() - defaultMinutes * 60_000 : NaN;
      if (!Number.isFinite(remindMs) || remindMs <= Date.now()) continue;
      const reminderPayload = {
        user_id: ctx.userId,
        title: `Pengingat: ${block.title}`,
        body: `${String(block.start_time).slice(0, 5)}–${String(block.end_time).slice(0, 5)}`,
        remind_at: new Date(remindMs).toISOString(),
        timezone: ctx.timezone,
        target_type: "schedule",
        target_id: block.id,
        offset_minutes: defaultMinutes,
        href: "/calendar",
        enabled: true,
        status: "pending",
        updated_at: new Date().toISOString(),
      };
      const { data: reminder, error: reminderError } = await ctx.supabase
        .from("reminders")
        .insert(reminderPayload)
        .select("id,title,remind_at,target_id,timezone,offset_minutes")
        .maybeSingle();
      if (reminder)
        autoReminders.push({
          ...reminder,
          remind_at_local: formatTimeInTimezone(reminder.remind_at, ctx.timezone),
          timezone_label: ctx.timezone,
        });
      else if (reminderError) reminderErrors.push({ block_id: block.id, error: reminderError.message });
    }
  }

  if (!createdBlocks.length) {
    return {
      ok: false,
      status: "no_changes",
      error: "Tidak ada agenda yang berhasil dibuat.",
      block_errors: blockErrors,
      reminder_errors: reminderErrors,
    };
  }

  const status = blockErrors.length || reminderErrors.length ? "partial" : "completed";
  return {
    ok: true,
    status,
    created: createdBlocks.length,
    blocks: createdBlocks,
    block_errors: blockErrors,
    auto_reminders_created: autoReminders.length,
    reminders: autoReminders,
    reminder_errors: reminderErrors,
  };
}

async function updateScheduleBlock(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = {};
  if (args.block_date) patch.block_date = args.block_date;
  if (args.start_time) patch.start_time = args.start_time;
  if (args.end_time) patch.end_time = args.end_time;
  if (args.title) patch.title = args.title;
  if (args.location !== undefined) patch.location = args.location;
  if (args.description !== undefined) patch.description = args.description;
  if (args.task_id !== undefined) patch.task_id = args.task_id;

  const { data, error } = await ctx.supabase
    .from("schedule_blocks")
    .update(patch)
    .eq("id", args.block_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  const reminder = await syncExistingScheduleReminder(ctx.supabase, ctx.userId, ctx.timezone, data);
  await emitLifeEvent(ctx.supabase, {
    userId: ctx.userId,
    eventType: "schedule.updated",
    entityType: "schedule",
    entityId: data.id,
    payload: { block_date: data.block_date, start_time: data.start_time, end_time: data.end_time },
  });
  return { ok: true, block: data, reminder };
}

async function resolveCalendarDate(ctx: HandlerCtx, args: any) {
  const now = new Date();
  const input = String(args?.input || args?.date || "hari ini");
  const resolved = resolveNaturalDate(input, now, ctx.timezone);
  const explicitValidation =
    args?.date && args?.expected_weekday
      ? validateWeekdayDate(String(args.date), String(args.expected_weekday), ctx.timezone)
      : null;
  const resolvedValidation =
    resolved[0]?.weekdayMatch === false
      ? {
          valid: false,
          actualWeekday: resolved[0].weekday,
          expectedWeekday: "terdapat di input",
          date: resolved[0].date,
          timezone: ctx.timezone,
        }
      : null;
  return {
    ok: true,
    timezone: ctx.timezone,
    context: buildTemporalContext(now, ctx.timezone),
    resolved,
    validation: explicitValidation || resolvedValidation,
  };
}

async function getSchedule(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("schedule_blocks")
    .select("id, block_date, start_time, end_time, title, location, description, created_by, task_id")
    .eq("user_id", ctx.userId)
    .gte("block_date", args.from_date)
    .lte("block_date", args.to_date)
    .order("block_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: data?.length ?? 0, blocks: data };
}

function cleanScheduleDeleteKeyword(value: unknown) {
  return normalizeScheduleTitle(
    String(value ?? "").replace(
      /\b(?:tolong|please|mohon|bisa|bantu|yang|jadwal|agenda|schedule|untuk|hapus|menghapus|hapuslah|buang|hilangkan|dihapus|hapuskan)\b/gi,
      " ",
    ),
  );
}

async function deleteScheduleBlock(ctx: HandlerCtx, args: any) {
  if (args.confirm_block_id) {
    const { data, error } = await ctx.supabase
      .from("schedule_blocks")
      .delete()
      .eq("id", args.confirm_block_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await cancelScheduleReminders(ctx.supabase, ctx.userId, [String(data.id)], "schedule_deleted");
    await emitLifeEvent(ctx.supabase, {
      userId: ctx.userId,
      eventType: "schedule.deleted",
      entityType: "schedule",
      entityId: data.id,
      payload: { title: data.title },
    });
    return { ok: true, deleted: data };
  }

  const cleanedKeyword = cleanScheduleDeleteKeyword(args.keyword);
  let query = ctx.supabase
    .from("schedule_blocks")
    .select("id, block_date, start_time, end_time, title")
    .eq("user_id", ctx.userId);
  if (cleanedKeyword) query = query.ilike("title", `%${cleanedKeyword}%`);
  if (args.block_date) query = query.eq("block_date", args.block_date);

  let { data, error } = await query.limit(20);
  if (error) return { ok: false, error: error.message };

  // Fallback for natural-language wrappers/partial titles. We intentionally
  // cap the candidate set to keep the delete flow bounded and safe.
  if ((!data || data.length === 0) && cleanedKeyword) {
    let fallbackQuery = ctx.supabase
      .from("schedule_blocks")
      .select("id, block_date, start_time, end_time, title")
      .eq("user_id", ctx.userId);
    if (args.block_date) fallbackQuery = fallbackQuery.eq("block_date", args.block_date);
    const fallback = await fallbackQuery
      .order("block_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(200);
    if (!fallback.error) {
      const tokens = cleanedKeyword.split(" ").filter((token: string) => token.length >= 2);
      data = (fallback.data ?? []).filter((row: any) => {
        const title = normalizeScheduleTitle(row.title);
        return tokens.length > 0 && tokens.every((token: string) => title.includes(token));
      });
    }
  }

  if (!data || data.length === 0)
    return {
      ok: true,
      status: "no_match",
      message: "Tidak ada blok jadwal yang cocok.",
      searched_keyword: cleanedKeyword || String(args.keyword || ""),
    };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

function normalizeScheduleTitle(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("id-ID")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scheduleTitleMatchesExclusion(title: unknown, keyword: unknown) {
  const titleText = normalizeScheduleTitle(title);
  const keywordText = normalizeScheduleTitle(keyword);
  if (!titleText || !keywordText) return false;
  if (titleText.includes(keywordText) || keywordText.includes(titleText)) return true;
  const titleTokens = new Set(titleText.split(" ").filter((token) => token.length >= 3));
  const keywordTokens = keywordText.split(" ").filter((token) => token.length >= 3);
  return keywordTokens.length > 0 && keywordTokens.every((token) => titleTokens.has(token));
}

async function deleteScheduleBlocksBulk(ctx: HandlerCtx, args: any) {
  const fromDate =
    typeof args.from_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.from_date) ? args.from_date : null;
  const toDate = typeof args.to_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.to_date) ? args.to_date : null;
  const keyword = String(args.keyword ?? "").trim();
  const excludeIds = new Set(
    (Array.isArray(args.exclude_ids) ? args.exclude_ids : []).map((x: unknown) => String(x).trim()).filter(Boolean),
  );
  const excludeKeywords = (Array.isArray(args.exclude_keywords) ? args.exclude_keywords : [])
    .map((x: unknown) => normalizeScheduleTitle(x))
    .filter(Boolean);

  let query = ctx.supabase
    .from("schedule_blocks")
    .select("id,title,block_date,start_time,end_time,location,description,task_id,project_id")
    .eq("user_id", ctx.userId)
    .order("block_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (fromDate) query = query.gte("block_date", fromDate);
  if (toDate) query = query.lte("block_date", toDate);
  if (keyword) query = query.ilike("title", `%${keyword}%`);

  const { data, error } = await query.limit(1000);
  if (error) return { ok: false, error: error.message, retryable: true };

  const allRows = data ?? [];
  const protectedRows = allRows.filter((row: any) => {
    if (excludeIds.has(String(row.id))) return true;
    return excludeKeywords.some((kw: string) => scheduleTitleMatchesExclusion(row.title, kw));
  });
  const targets = allRows.filter((row: any) => !protectedRows.some((p: any) => p.id === row.id));

  const preview = {
    target_count: targets.length,
    protected_count: protectedRows.length,
    targets,
    protected: protectedRows,
    filter: { from_date: fromDate, to_date: toDate, keyword: keyword || null },
  };

  if (args.confirm_all !== true) {
    return {
      ok: true,
      status: "confirmation_required",
      code: "SCHEDULE_BULK_DELETE_CONFIRM",
      requires_confirmation: true,
      ...preview,
      message: targets.length
        ? `Ada ${targets.length} agenda yang akan dihapus dan ${protectedRows.length} agenda dipertahankan.`
        : "Tidak ada agenda yang memenuhi kriteria setelah pengecualian diterapkan.",
    };
  }

  if (!targets.length) {
    return {
      ok: true,
      status: "no_changes",
      deleted: 0,
      protected_count: protectedRows.length,
      message: "Tidak ada agenda yang perlu dihapus.",
    };
  }

  const ids = targets.map((row: any) => row.id).filter(Boolean);
  const { data: deleted, error: deleteError } = await ctx.supabase
    .from("schedule_blocks")
    .delete()
    .in("id", ids)
    .eq("user_id", ctx.userId)
    .select("id,title,block_date,start_time,end_time");
  if (deleteError) return { ok: false, error: deleteError.message, retryable: true, requested_count: ids.length };

  const deletedIds = (deleted ?? []).map((row: any) => String(row.id));
  if (deletedIds.length) {
    await cancelScheduleReminders(ctx.supabase, ctx.userId, deletedIds, "schedule_bulk_deleted");
    for (const row of deleted ?? []) {
      await emitLifeEvent(ctx.supabase, {
        userId: ctx.userId,
        eventType: "schedule.deleted",
        entityType: "schedule",
        entityId: row.id,
        payload: { title: row.title, bulk: true },
      });
    }
  }

  const actual = deletedIds.length;
  return {
    ok: true,
    status: actual === ids.length ? "completed" : "partial",
    operation: "bulk_delete_schedule",
    count: actual,
    requested_count: ids.length,
    protected_count: protectedRows.length,
    deleted: deleted ?? [],
    protected: protectedRows,
  };
}

async function captureInboxItem(ctx: HandlerCtx, args: any) {
  const content = String(args.content ?? "").trim();
  if (!content) return { ok: false, error: "Isi inbox kosong." };
  const { data, error } = await ctx.supabase
    .from("smart_inbox_items")
    .insert({ user_id: ctx.userId, content, kind: "inbox", status: "open" })
    .select("id, content, kind, status, created_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, item: data };
}

async function getDecisions(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("decisions")
    .select("id, title, context, options, decision, confidence, review_date, outcome, created_at, updated_at")
    .eq("user_id", ctx.userId)
    .order("review_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (args.review_only) {
    query = query.not("review_date", "is", null).lte("review_date", dateStrInTimezone(new Date(), ctx.timezone));
  }
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, decisions: data ?? [] };
}

async function updateDecision(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of ["title", "context", "decision", "review_date", "outcome", "result_rating"]) {
    if (args[key] !== undefined) patch[key] = args[key] === "" ? null : args[key];
  }
  if (args.confidence !== undefined) patch.confidence = Math.max(1, Math.min(5, Number(args.confidence)));
  const { data, error } = await ctx.supabase
    .from("decisions")
    .update(patch)
    .eq("id", args.decision_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, decision: data };
}

async function deleteDecision(ctx: HandlerCtx, args: any) {
  if (args.confirm_decision_id) {
    const { data, error } = await ctx.supabase
      .from("decisions")
      .delete()
      .eq("id", args.confirm_decision_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase
    .from("decisions")
    .select("id,title,decision,review_date")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });
  if (args.keyword) query = query.ilike("title", `%${args.keyword}%`);
  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, status: "no_match", message: "Tidak ada keputusan yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function logDecision(ctx: HandlerCtx, args: any) {
  const confidence = Math.max(1, Math.min(5, Number(args.confidence ?? 3)));
  const { data, error } = await ctx.supabase
    .from("decisions")
    .insert({
      user_id: ctx.userId,
      title: args.title,
      context: args.context ?? null,
      options: Array.isArray(args.options) ? args.options.filter(Boolean).slice(0, 10) : [],
      decision: args.decision,
      confidence,
      review_date: args.review_date ?? null,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, decision: data };
}

async function getSkills(ctx: HandlerCtx) {
  const { data, error } = await ctx.supabase
    .from("skills")
    .select("id, name, category, level, target_level, goal_id, resource_url, notes, created_at, updated_at")
    .eq("user_id", ctx.userId)
    .order("level", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) return { ok: false, error: error.message };
  return { ok: true, skills: data ?? [] };
}

async function createSkill(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("skills")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      category: args.category ?? null,
      goal_id: args.goal_id ?? null,
      resource_url: args.resource_url ?? null,
      learning_mode: args.learning_mode ?? "practice",
      target_level: Math.max(0, Math.min(100, Number(args.target_level ?? 100))),
      target_date: args.target_date ?? null,
      level: 0,
      hours_spent: 0,
      next_action: args.next_action ?? null,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, skill: data };
}

async function deleteSkill(ctx: HandlerCtx, args: any) {
  if (args.confirm_skill_id) {
    const { data, error } = await ctx.supabase
      .from("skills")
      .delete()
      .eq("id", args.confirm_skill_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase
    .from("skills")
    .select("id,name,category,level")
    .eq("user_id", ctx.userId)
    .order("updated_at", { ascending: false });
  if (args.keyword) query = query.ilike("name", `%${args.keyword}%`);
  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, status: "no_match", message: "Tidak ada skill yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function updateSkill(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (args.level !== undefined) patch.level = Math.max(0, Math.min(100, Number(args.level)));
  if (args.category !== undefined) patch.category = args.category;
  if (args.resource_url !== undefined) patch.resource_url = args.resource_url;
  if (args.notes !== undefined) patch.notes = args.notes;
  const { data, error } = await ctx.supabase
    .from("skills")
    .update(patch)
    .eq("id", args.skill_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, skill: data };
}

async function getLifeSnapshot(ctx: HandlerCtx) {
  const now = new Date();
  const today = dateStrInTimezone(now, ctx.timezone);
  const monthStart = startOfMonthIsoForTimezone(now, ctx.timezone);
  const weekStart = startOfWeekIsoForTimezone(now, ctx.timezone);
  const [
    tasksRes,
    agendaRes,
    focusRes,
    inboxRes,
    projectsRes,
    goalsRes,
    expenseRes,
    incomeRes,
    subsRes,
    habitsRes,
    decisionsRes,
  ] = await Promise.all([
    ctx.supabase
      .from("tasks")
      .select("id,title,status,priority,due_at,project_id")
      .eq("user_id", ctx.userId)
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(12),
    ctx.supabase
      .from("schedule_blocks")
      .select("id,title,block_date,start_time,end_time,project_id")
      .eq("user_id", ctx.userId)
      .gte("block_date", today)
      .order("block_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(10),
    ctx.supabase
      .from("pomodoro_sessions")
      .select("focus_minutes,started_at")
      .eq("user_id", ctx.userId)
      .gte("started_at", weekStart)
      .limit(100),
    ctx.supabase
      .from("smart_inbox_items")
      .select("id,content,kind,created_at")
      .eq("user_id", ctx.userId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(8),
    ctx.supabase
      .from("projects")
      .select("id,name,status,target_date,goal_id,updated_at")
      .eq("user_id", ctx.userId)
      .in("status", ["active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(8),
    ctx.supabase
      .from("goals")
      .select("id,title,progress,status,target_date,next_step")
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .order("target_date", { ascending: true, nullsFirst: false })
      .limit(8),
    ctx.supabase
      .from("expenses")
      .select("amount,category,occurred_at")
      .eq("user_id", ctx.userId)
      .gte("occurred_at", monthStart)
      .limit(300),
    ctx.supabase
      .from("incomes")
      .select("amount,source,occurred_at")
      .eq("user_id", ctx.userId)
      .gte("occurred_at", monthStart)
      .limit(300),
    ctx.supabase
      .from("subscriptions")
      .select("name,amount,billing_cycle,next_billing_date,active")
      .eq("user_id", ctx.userId)
      .eq("active", true)
      .order("next_billing_date", { ascending: true })
      .limit(8),
    ctx.supabase
      .from("habit_checkins")
      .select("habit_id,checkin_date")
      .eq("user_id", ctx.userId)
      .gte("checkin_date", today.slice(0, 7) + "-01")
      .limit(500),
    ctx.supabase
      .from("decisions")
      .select("title,review_date,outcome")
      .eq("user_id", ctx.userId)
      .is("outcome", null)
      .order("review_date", { ascending: true, nullsFirst: false })
      .limit(6),
  ]);
  const tasks = tasksRes.data ?? [];
  const overdue = tasks.filter((x: any) => x.due_at && new Date(x.due_at).getTime() < Date.now());
  const focusMin = (focusRes.data ?? []).reduce((s: number, x: any) => s + Number(x.focus_minutes || 0), 0);
  const spend = (expenseRes.data ?? []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const income = (incomeRes.data ?? []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const topCategory = Object.entries(
    (expenseRes.data ?? []).reduce((a: any, x: any) => {
      a[x.category] = (a[x.category] || 0) + Number(x.amount || 0);
      return a;
    }, {}),
  ).sort((a: any, b: any) => b[1] - a[1])[0];
  const staleProjects = (projectsRes.data ?? []).filter(
    (x: any) => Date.now() - new Date(x.updated_at).getTime() > 5 * 86400000,
  );
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    today,
    priorities: {
      overdue_tasks: overdue.slice(0, 5).map((x: any) => x.title),
      high_priority_tasks: tasks
        .filter((x: any) => x.priority === "high")
        .slice(0, 5)
        .map((x: any) => x.title),
      stale_projects: staleProjects.slice(0, 5).map((x: any) => x.name),
    },
    counts: {
      open_tasks: tasks.length,
      overdue_tasks: overdue.length,
      agenda_upcoming: (agendaRes.data ?? []).length,
      inbox_open: (inboxRes.data ?? []).length,
      active_projects: (projectsRes.data ?? []).length,
      active_goals: (goalsRes.data ?? []).length,
      active_subscriptions: (subsRes.data ?? []).length,
      decisions_needing_review: (decisionsRes.data ?? []).length,
    },
    today_agenda: (agendaRes.data ?? [])
      .slice(0, 6)
      .map((x: any) => ({
        title: x.title,
        date: x.block_date,
        start: String(x.start_time).slice(0, 5),
        end: String(x.end_time).slice(0, 5),
      })),
    tasks: tasks
      .slice(0, 8)
      .map((x: any) => ({ title: x.title, status: x.status, priority: x.priority, due_at: x.due_at })),
    projects: (projectsRes.data ?? [])
      .slice(0, 6)
      .map((x: any) => ({ name: x.name, status: x.status, target_date: x.target_date, last_changed: x.updated_at })),
    goals: (goalsRes.data ?? [])
      .slice(0, 6)
      .map((x: any) => ({ title: x.title, progress: x.progress, target_date: x.target_date, next_step: x.next_step })),
    finance: {
      month_income: income,
      month_expense: spend,
      month_net: income - spend,
      top_category: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
    },
    focus_7d_minutes: focusMin,
    inbox: (inboxRes.data ?? [])
      .slice(0, 5)
      .map((x: any) => ({ content: String(x.content || "").slice(0, 160), kind: x.kind })),
    subscriptions: (subsRes.data ?? [])
      .slice(0, 5)
      .map((x: any) => ({
        name: x.name,
        amount: x.amount,
        next_billing_date: x.next_billing_date,
        billing_cycle: x.billing_cycle,
      })),
    routine_checkins_this_month: (habitsRes.data ?? []).length,
    decisions_due: (decisionsRes.data ?? [])
      .slice(0, 5)
      .map((x: any) => ({ title: x.title, review_date: x.review_date })),
  };
}

async function getTaskDependencies(ctx: HandlerCtx, args: any) {
  const taskId = String(args.task_id || "").trim();
  if (!taskId) return { ok: false, error: "task_id wajib diisi." };
  const { data, error } = await ctx.supabase
    .from("life_os_task_dependencies")
    .select("id,task_id,depends_on_task_id,relation,created_at")
    .eq("user_id", ctx.userId)
    .or(`task_id.eq.${taskId},depends_on_task_id.eq.${taskId}`)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, dependencies: data || [] };
}

async function createTaskDependency(ctx: HandlerCtx, args: any) {
  const taskId = String(args.task_id || "").trim();
  const dependsOn = String(args.depends_on_task_id || "").trim();
  const relation = args.relation === "related" ? "related" : "blocks";
  if (!taskId || !dependsOn) return { ok: false, error: "task_id dan depends_on_task_id wajib diisi." };
  if (taskId === dependsOn) return { ok: false, error: "Task tidak boleh bergantung pada dirinya sendiri." };
  const check = await ctx.supabase
    .from("tasks")
    .select("id,title")
    .eq("user_id", ctx.userId)
    .in("id", [taskId, dependsOn]);
  if (check.error) return { ok: false, error: check.error.message };
  if ((check.data || []).length !== 2) return { ok: false, error: "Salah satu task tidak ditemukan." };
  const { data, error } = await ctx.supabase
    .from("life_os_task_dependencies")
    .insert({ user_id: ctx.userId, task_id: taskId, depends_on_task_id: dependsOn, relation })
    .select("id,task_id,depends_on_task_id,relation,created_at")
    .single();
  if (error) {
    if (String(error.code) === "23505") return { ok: true, existing: true, message: "Dependency sudah ada." };
    return { ok: false, error: error.message };
  }
  return { ok: true, dependency: data };
}

async function deleteTaskDependency(ctx: HandlerCtx, args: any) {
  const id = String(args.dependency_id || "").trim();
  if (!id) return { ok: false, error: "dependency_id wajib diisi." };
  if (args.confirm !== true)
    return {
      ok: false,
      code: "TASK_DEPENDENCY_DELETE_CONFIRM",
      error: "Penghapusan dependency membutuhkan confirm=true.",
    };
  const { data, error } = await ctx.supabase
    .from("life_os_task_dependencies")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Dependency tidak ditemukan." };
  return { ok: true, deleted: data.id };
}

async function getDailyBrain(ctx: HandlerCtx) {
  const { buildDailyBrain } = await import("@/lib/v35/brain");
  return buildDailyBrain(ctx.supabase, ctx.userId, ctx.timezone);
}

async function simulatePlanner(ctx: HandlerCtx, args: any) {
  const from = String(args.from || dateStrInTimezone(new Date(), ctx.timezone));
  const to = String(args.to || dateStrInTimezone(new Date(Date.now() + 7 * 86400000), ctx.timezone));
  const shift = Number(args.shift_minutes || 0);
  const exclude = String(args.exclude_task_keyword || "")
    .trim()
    .toLowerCase();
  const [tasksRes, agendaRes] = await Promise.all([
    ctx.supabase
      .from("tasks")
      .select("id,title,due_at,estimated_minutes,priority,status")
      .eq("user_id", ctx.userId)
      .neq("status", "done")
      .limit(150),
    ctx.supabase
      .from("schedule_blocks")
      .select("id,title,block_date,start_time,end_time")
      .eq("user_id", ctx.userId)
      .gte("block_date", from)
      .lte("block_date", to)
      .order("block_date")
      .order("start_time")
      .limit(300),
  ]);
  if (tasksRes.error || agendaRes.error)
    return { ok: false, error: tasksRes.error?.message || agendaRes.error?.message || "Data planner tidak tersedia." };
  const agenda = (agendaRes.data || []).map((item: any) => ({
    ...item,
    simulated_start: shiftClock(item.start_time, shift),
    simulated_end: shiftClock(item.end_time, shift),
  }));
  const conflicts: any[] = [];
  const byDate = new Map<string, any[]>();
  for (const item of agenda) {
    const list = byDate.get(String(item.block_date)) || [];
    list.push(item);
    byDate.set(String(item.block_date), list);
  }
  for (const [date, list] of byDate) {
    const sorted = list.slice().sort((a, b) => String(a.simulated_start).localeCompare(String(b.simulated_start)));
    for (let i = 1; i < sorted.length; i++)
      if (String(sorted[i].simulated_start) < String(sorted[i - 1].simulated_end))
        conflicts.push({ date, first: sorted[i - 1].title, second: sorted[i].title });
  }
  const tasks = (tasksRes.data || []).filter(
    (task: any) => !exclude || !String(task.title).toLowerCase().includes(exclude),
  );
  const workloadMinutes = tasks.reduce((n: number, t: any) => n + Number(t.estimated_minutes || 25), 0);
  return {
    ok: true,
    simulationOnly: true,
    range: { from, to },
    shiftMinutes: shift,
    workloadMinutes,
    affectedTasks: tasks.length,
    agendaCount: agenda.length,
    conflicts,
    summary: conflicts.length ? `${conflicts.length} konflik terdeteksi.` : "Tidak ada konflik baru dalam simulasi.",
  };
}

function shiftClock(value: string, delta: number) {
  const [h, m] = String(value).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return String(value);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

async function getAiWatchers(ctx: HandlerCtx) {
  const { data, error } = await ctx.supabase
    .from("ai_watchers")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: error.message };
  return { ok: true, watchers: data || [] };
}

async function createAiWatcher(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("ai_watchers")
    .insert({
      user_id: ctx.userId,
      name: String(args.name || "Pengawas AI").slice(0, 120),
      description: String(args.description || "").slice(0, 1000) || null,
      entity_type: String(args.entity_type || "life_os"),
      condition: args.condition || {},
      action: args.action || {},
      enabled: true,
      cooldown_minutes: Math.max(5, Math.min(10080, Number(args.cooldown_minutes || 1440))),
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  emitLifeEvent(ctx.supabase, {
    userId: ctx.userId,
    eventType: "ai_watcher.created",
    entityType: "ai_watcher",
    entityId: data.id,
    payload: { name: data.name },
  }).catch(() => null);
  return { ok: true, watcher: data };
}

async function updateAiWatcher(ctx: HandlerCtx, args: any) {
  const id = String(args.watcher_id || "");
  if (!id) return { ok: false, error: "watcher_id wajib diisi." };
  const patch: any = {};
  for (const key of ["name", "description", "condition", "action", "enabled", "cooldown_minutes"])
    if (args[key] !== undefined) patch[key] = args[key];
  const { data, error } = await ctx.supabase
    .from("ai_watchers")
    .update(patch)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, watcher: data };
}

async function deleteAiWatcher(ctx: HandlerCtx, args: any) {
  const id = String(args.watcher_id || "");
  if (!id) return { ok: false, error: "watcher_id wajib diisi." };
  if (args.confirm !== true)
    return { ok: false, code: "AI_WATCHER_DELETE_CONFIRM", error: "Penghapusan watcher memerlukan confirm=true." };
  const { data, error } = await ctx.supabase
    .from("ai_watchers")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Watcher tidak ditemukan." };
  return { ok: true, deleted: data.id };
}

async function getTodayOverview(ctx: HandlerCtx) {
  const today = new Date();
  const dateStr = dateStrInTimezone(today, ctx.timezone);
  const startOfDay = startOfDayIsoForTimezone(today, ctx.timezone);
  const endOfDay = endOfDayIsoForTimezone(today, ctx.timezone);

  const [tasksRes, scheduleRes, pomodoroRes, expenseRes, inboxRes, goalsRes] = await Promise.all([
    ctx.supabase
      .from("tasks")
      .select("id, title, status, priority, due_at")
      .eq("user_id", ctx.userId)
      .neq("status", "done")
      .gte("due_at", startOfDay)
      .lte("due_at", endOfDay),
    ctx.supabase
      .from("schedule_blocks")
      .select("id, start_time, end_time, title")
      .eq("user_id", ctx.userId)
      .eq("block_date", dateStr)
      .order("start_time", { ascending: true }),
    ctx.supabase
      .from("pomodoro_sessions")
      .select("focus_minutes")
      .eq("user_id", ctx.userId)
      .gte("started_at", startOfDay)
      .lte("started_at", endOfDay),
    ctx.supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", ctx.userId)
      .gte("occurred_at", startOfDay)
      .lte("occurred_at", endOfDay),
    ctx.supabase
      .from("smart_inbox_items")
      .select("id, content, kind, created_at")
      .eq("user_id", ctx.userId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5),
    ctx.supabase
      .from("goals")
      .select("id, title, progress, target_date, category")
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .order("target_date", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  const totalFocusMinutes = (pomodoroRes.data ?? []).reduce((s, p) => s + Number(p.focus_minutes), 0);
  const totalExpenseToday = (expenseRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return {
    ok: true,
    date: dateStr,
    tasks_due_today: tasksRes.data ?? [],
    schedule_today: scheduleRes.data ?? [],
    total_focus_minutes_today: totalFocusMinutes,
    total_expense_today: totalExpenseToday,
    smart_inbox_open: inboxRes.data ?? [],
    active_goals: goalsRes.data ?? [],
  };
}

// ---- Fase 3: keuangan (income/budget) & kesehatan --------------------------------

async function logIncome(ctx: HandlerCtx, args: any) {
  const amount = normalizeMoneyAmount(args.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Jumlah pemasukan harus lebih besar dari 0." };
  const resolved = await resolveAccount(ctx, args.account_id, args.account_name);
  if (!resolved.ok) return resolved;
  if (resolved.requires_account)
    return {
      ok: false,
      status: "account_required",
      message: "Pilih atau sebutkan rekening penerima agar saldo dapat diperbarui.",
      candidates: resolved.candidates,
    };

  const { data, error } = await ctx.supabase
    .from("incomes")
    .insert({
      user_id: ctx.userId,
      amount,
      source: args.source,
      note: args.note ?? null,
      account_id: resolved.account?.id ?? null,
      occurred_at: ensureTimezoneOffset(args.occurred_at, ctx.timezone) ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  const balance = resolved.account?.id ? await getAccountBalance(ctx, resolved.account.id) : null;
  return {
    ok: true,
    income: data,
    account: balance,
    balance_changed: Boolean(resolved.account?.id),
    message: resolved.account
      ? `Pemasukan dicatat ke ${resolved.account.name}. Saldo dompet sekarang ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(balance?.current_balance ?? 0))}.`
      : "Pemasukan dicatat tanpa mengaitkan dompet.",
  };
}

async function deleteIncome(ctx: HandlerCtx, args: any) {
  if (args.confirm_income_id) {
    const { data, error } = await ctx.supabase
      .from("incomes")
      .delete()
      .eq("id", args.confirm_income_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }

  let query = ctx.supabase.from("incomes").select("id, amount, source, note, occurred_at").eq("user_id", ctx.userId);
  if (args.keyword) query = query.or(`note.ilike.%${args.keyword}%,source.ilike.%${args.keyword}%`);

  const { data, error } = await query.order("occurred_at", { ascending: false }).limit(10);
  if (error) return { ok: false, error: error.message };

  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada pemasukan yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function getIncomes(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("incomes")
    .select("id, amount, source, note, occurred_at")
    .eq("user_id", ctx.userId)
    .gte("occurred_at", args.from_date)
    .lte("occurred_at", `${args.to_date}T23:59:59`)
    .order("occurred_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  const total = (data ?? []).reduce((s, i) => s + Number(i.amount), 0);
  return { ok: true, total, count: data?.length ?? 0, items: data };
}

async function updateIncome(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = {};
  if (args.amount !== undefined) patch.amount = args.amount;
  if (args.source) patch.source = args.source;
  if (args.note !== undefined) patch.note = args.note;
  if (args.occurred_at) patch.occurred_at = ensureTimezoneOffset(args.occurred_at, ctx.timezone);
  if (args.account_id || args.account_name) {
    const resolved = await resolveAccount(ctx, args.account_id, args.account_name);
    if (!resolved.ok) return resolved;
    if (!resolved.account?.id)
      return { ok: false, status: "account_required", message: "Rekening penerima belum dapat ditentukan." };
    patch.account_id = resolved.account.id;
  }

  const { data, error } = await ctx.supabase
    .from("incomes")
    .update(patch)
    .eq("id", args.income_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  const balance = data?.account_id ? await getAccountBalance(ctx, String(data.account_id)) : null;
  return { ok: true, income: data, account: balance };
}

function currentPeriodRange(ctx: HandlerCtx, period: "weekly" | "monthly") {
  const now = new Date();
  if (period === "weekly") {
    return { start: startOfWeekIsoForTimezone(now, ctx.timezone), end: now.toISOString() };
  }
  return { start: startOfMonthIsoForTimezone(now, ctx.timezone), end: now.toISOString() };
}

async function createBudget(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("budgets")
    .insert({
      user_id: ctx.userId,
      category: args.category,
      limit_amount: args.limit_amount,
      period: args.period ?? "monthly",
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, budget: data };
}

async function updateBudget(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("budgets")
    .update({ limit_amount: args.limit_amount })
    .eq("id", args.budget_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, budget: data };
}

async function deleteBudget(ctx: HandlerCtx, args: any) {
  if (args.confirm_budget_id) {
    const { data, error } = await ctx.supabase
      .from("budgets")
      .delete()
      .eq("id", args.confirm_budget_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }

  let query = ctx.supabase.from("budgets").select("id, category, limit_amount, period").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("category", `%${args.keyword}%`);

  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };

  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada anggaran yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function getBudgets(ctx: HandlerCtx) {
  const { data: budgets, error } = await ctx.supabase
    .from("budgets")
    .select("id, category, limit_amount, period")
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };

  const results = [];
  for (const b of budgets ?? []) {
    const { start, end } = currentPeriodRange(ctx, b.period);
    const { data: expenses } = await ctx.supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", ctx.userId)
      .eq("category", b.category)
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    const spent = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
    results.push({
      ...b,
      spent,
      remaining: Number(b.limit_amount) - spent,
      percent_used: Math.round((spent / Number(b.limit_amount)) * 100),
    });
  }

  return { ok: true, budgets: results };
}

const HEALTH_TABLE_MAP: Record<string, { table: string; searchCol: string }> = {
  hydration: { table: "hydration_logs", searchCol: "" },
  caffeine: { table: "caffeine_logs", searchCol: "drink" },
  meal: { table: "meal_logs", searchCol: "description" },
  medication: { table: "medication_logs", searchCol: "medication_name" },
  energy: { table: "fatigue_logs", searchCol: "" },
};

async function deleteHealthLog(ctx: HandlerCtx, args: any) {
  const mapping = HEALTH_TABLE_MAP[args.kind];
  if (!mapping) return { ok: false, error: `kind tidak dikenal: ${args.kind}` };

  if (args.confirm_log_id) {
    const { data, error } = await ctx.supabase
      .from(mapping.table)
      .delete()
      .eq("id", args.confirm_log_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }

  let query = ctx.supabase.from(mapping.table).select("*").eq("user_id", ctx.userId);
  if (args.keyword && mapping.searchCol) {
    query = query.ilike(mapping.searchCol, `%${args.keyword}%`);
  }

  const { data, error } = await query.order("logged_at", { ascending: false }).limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: true, status: "no_match", message: "Tidak ada catatan kesehatan yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function logHealth(ctx: HandlerCtx, args: any) {
  switch (args.kind) {
    case "hydration": {
      if (!args.amount_ml) return { ok: false, error: "amount_ml wajib diisi untuk hidrasi." };
      const { data, error } = await ctx.supabase
        .from("hydration_logs")
        .insert({ user_id: ctx.userId, amount_ml: args.amount_ml })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, log: data };
    }
    case "caffeine": {
      if (!args.drink) return { ok: false, error: "drink wajib diisi untuk kafein." };
      const { data, error } = await ctx.supabase
        .from("caffeine_logs")
        .insert({ user_id: ctx.userId, drink: args.drink, mg_estimate: args.mg_estimate ?? null })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, log: data };
    }
    case "meal": {
      if (!args.description) return { ok: false, error: "description wajib diisi untuk makan." };
      const { data, error } = await ctx.supabase
        .from("meal_logs")
        .insert({
          user_id: ctx.userId,
          meal_type: args.meal_type ?? null,
          description: args.description,
          calories: args.calories_estimate ?? null,
          protein_g: args.protein_g_estimate ?? null,
          carbs_g: args.carbs_g_estimate ?? null,
          fat_g: args.fat_g_estimate ?? null,
        })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, log: data };
    }
    case "medication": {
      if (!args.medication_name) return { ok: false, error: "medication_name wajib diisi untuk obat." };
      const { data, error } = await ctx.supabase
        .from("medication_logs")
        .insert({ user_id: ctx.userId, medication_name: args.medication_name, dosage: args.dosage ?? null })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, log: data };
    }
    case "energy": {
      const score = Number(args.energy_score);
      if (!Number.isFinite(score) || score < 1 || score > 5) return { ok: false, error: "energy_score harus 1-5." };
      const { data, error } = await ctx.supabase
        .from("fatigue_logs")
        .insert({ user_id: ctx.userId, fatigue_score: Math.round(score), note: args.note ?? null })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, log: data };
    }
    default:
      return { ok: false, error: `kind tidak dikenal: ${args.kind}` };
  }
}

async function getHealthSummary(ctx: HandlerCtx) {
  const startIso = startOfDayIsoForTimezone(new Date(), ctx.timezone);

  const [hydration, caffeine, meals, medication, energy] = await Promise.all([
    ctx.supabase
      .from("hydration_logs")
      .select("amount_ml, logged_at")
      .eq("user_id", ctx.userId)
      .gte("logged_at", startIso),
    ctx.supabase
      .from("caffeine_logs")
      .select("drink, mg_estimate, logged_at")
      .eq("user_id", ctx.userId)
      .gte("logged_at", startIso),
    ctx.supabase
      .from("meal_logs")
      .select("meal_type, description, calories, protein_g, carbs_g, fat_g, logged_at")
      .eq("user_id", ctx.userId)
      .gte("logged_at", startIso),
    ctx.supabase
      .from("medication_logs")
      .select("medication_name, dosage, logged_at")
      .eq("user_id", ctx.userId)
      .gte("logged_at", startIso),
    ctx.supabase
      .from("fatigue_logs")
      .select("fatigue_score, note, logged_at")
      .eq("user_id", ctx.userId)
      .gte("logged_at", startIso)
      .order("logged_at", { ascending: false })
      .limit(1),
  ]);

  const totalHydrationMl = (hydration.data ?? []).reduce((s, h) => s + Number(h.amount_ml), 0);
  const totalCalories = (meals.data ?? []).reduce((s, m) => s + Number(m.calories ?? 0), 0);
  const latestEnergy = energy.data?.[0] ?? null;

  return {
    ok: true,
    total_hydration_ml_today: totalHydrationMl,
    caffeine_today: caffeine.data ?? [],
    meals_today: meals.data ?? [],
    total_calories_today_estimate: totalCalories,
    medication_today: medication.data ?? [],
    latest_energy: latestEnergy,
  };
}

async function createAccount(ctx: HandlerCtx, args: any) {
  const makeDefault = Boolean(args.is_default);
  if (makeDefault) {
    await ctx.supabase.from("accounts").update({ is_default: false }).eq("user_id", ctx.userId);
  }
  const { data, error } = await ctx.supabase
    .from("accounts")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      starting_balance: args.starting_balance ?? 0,
      account_type: args.account_type ?? "bank",
      is_default: makeDefault,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, account: data };
}

async function updateAccount(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = {};
  if (args.name) patch.name = args.name;
  if (args.starting_balance !== undefined) patch.starting_balance = args.starting_balance;
  if (args.account_type) patch.account_type = args.account_type;
  if (args.is_default !== undefined) {
    if (args.is_default) await ctx.supabase.from("accounts").update({ is_default: false }).eq("user_id", ctx.userId);
    patch.is_default = Boolean(args.is_default);
  }

  const { data, error } = await ctx.supabase
    .from("accounts")
    .update(patch)
    .eq("id", args.account_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, account: data };
}

async function getAccounts(ctx: HandlerCtx) {
  const [accountResult, incomeResult, expenseResult, transferResult] = await Promise.all([
    ctx.supabase
      .from("accounts")
      .select("id, name, starting_balance, current_balance, account_type, is_default, created_at")
      .eq("user_id", ctx.userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    ctx.supabase.from("incomes").select("amount,account_id").eq("user_id", ctx.userId).not("account_id", "is", null),
    ctx.supabase.from("expenses").select("amount,account_id").eq("user_id", ctx.userId).not("account_id", "is", null),
    ctx.supabase.from("account_transfers").select("amount,from_account_id,to_account_id").eq("user_id", ctx.userId),
  ]);
  let accounts: any[] = accountResult.data ?? [];
  if (accountResult.error) {
    const legacy = await ctx.supabase
      .from("accounts")
      .select("id,name,starting_balance,account_type,is_default,created_at")
      .eq("user_id", ctx.userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (legacy.error) return { ok: false, error: legacy.error.message };
    accounts = legacy.data ?? [];
  }
  const incomes = incomeResult.data;
  const expenses = expenseResult.data;
  const transfers = transferResult.data;

  const results = (accounts ?? []).map((a: any) => {
    const income = (incomes ?? [])
      .filter((row: any) => row.account_id === a.id)
      .reduce((s: number, row: any) => s + Number(row.amount || 0), 0);
    const expense = (expenses ?? [])
      .filter((row: any) => row.account_id === a.id)
      .reduce((s: number, row: any) => s + Number(row.amount || 0), 0);
    const transferIn = (transfers ?? [])
      .filter((row: any) => row.to_account_id === a.id)
      .reduce((s: number, row: any) => s + Number(row.amount || 0), 0);
    const transferOut = (transfers ?? [])
      .filter((row: any) => row.from_account_id === a.id)
      .reduce((s: number, row: any) => s + Number(row.amount || 0), 0);
    return {
      ...a,
      income_total: income,
      expense_total: expense,
      transfer_in: transferIn,
      transfer_out: transferOut,
      current_balance:
        a.current_balance == null
          ? Number(a.starting_balance || 0) + income - expense + transferIn - transferOut
          : Number(a.current_balance),
    };
  });
  return { ok: true, accounts: results };
}

async function transferMoney(ctx: HandlerCtx, args: any) {
  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Jumlah transfer harus lebih besar dari 0." };
  const from = await resolveAccount(ctx, args.from_account_id, args.from_account_name);
  if (!from.ok) return from;
  const to = await resolveAccount(ctx, args.to_account_id, args.to_account_name);
  if (!to.ok) return to;
  if (!from.account?.id || !to.account?.id) return { ok: false, error: "Sumber dan tujuan transfer wajib ditentukan." };
  if (from.account.id === to.account.id) return { ok: false, error: "Dompet sumber dan tujuan harus berbeda." };

  const occurredAt = ensureTimezoneOffset(args.occurred_at, ctx.timezone) ?? new Date().toISOString();
  const { data, error } = await ctx.supabase.rpc("licia_transfer_money", {
    p_from_account_id: from.account.id,
    p_to_account_id: to.account.id,
    p_amount: amount,
    p_note: args.note ?? null,
    p_occurred_at: occurredAt,
  });
  if (error) {
    if (/saldo dompet sumber tidak cukup|insufficient_funds/i.test(error.message)) {
      return { ok: false, status: "insufficient_funds", error: error.message };
    }
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    ...(data as Record<string, unknown>),
    message: `Transfer berhasil dari ${from.account.name} ke ${to.account.name}.`,
  };
}

async function getAccountTransactions(ctx: HandlerCtx, args: any) {
  const resolved = await resolveAccount(ctx, args.account_id, args.account_name);
  if (!resolved.ok) return resolved;
  if (!resolved.account?.id)
    return { ok: false, status: "account_required", message: "Sebutkan dompet yang ingin diperiksa." };
  const limit = Math.min(100, Math.max(1, Number(args.limit) || 30));
  const accountId = resolved.account.id;
  const [{ data: expenses }, { data: incomes }, { data: transfersOut }, { data: transfersIn }] = await Promise.all([
    ctx.supabase
      .from("expenses")
      .select("id,amount,category,note,occurred_at")
      .eq("user_id", ctx.userId)
      .eq("account_id", accountId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    ctx.supabase
      .from("incomes")
      .select("id,amount,source,note,occurred_at")
      .eq("user_id", ctx.userId)
      .eq("account_id", accountId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    ctx.supabase
      .from("account_transfers")
      .select("id,amount,note,occurred_at,to_account_id")
      .eq("user_id", ctx.userId)
      .eq("from_account_id", accountId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    ctx.supabase
      .from("account_transfers")
      .select("id,amount,note,occurred_at,from_account_id")
      .eq("user_id", ctx.userId)
      .eq("to_account_id", accountId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
  ]);
  const targetIds = new Set(
    [
      ...(transfersOut ?? []).map((x: any) => x.to_account_id),
      ...(transfersIn ?? []).map((x: any) => x.from_account_id),
    ].filter(Boolean),
  );
  const { data: relatedAccounts } = targetIds.size
    ? await ctx.supabase
        .from("accounts")
        .select("id,name")
        .eq("user_id", ctx.userId)
        .in("id", [...targetIds])
    : { data: [] as any[] };
  const names = new Map((relatedAccounts ?? []).map((x: any) => [x.id, x.name]));
  const transactions = [
    ...(expenses ?? []).map((x: any) => ({ ...x, kind: "expense", direction: "out", label: x.category })),
    ...(incomes ?? []).map((x: any) => ({ ...x, kind: "income", direction: "in", label: x.source })),
    ...(transfersOut ?? []).map((x: any) => ({
      ...x,
      kind: "transfer",
      direction: "out",
      label: `Transfer ke ${names.get(x.to_account_id) || "dompet lain"}`,
    })),
    ...(transfersIn ?? []).map((x: any) => ({
      ...x,
      kind: "transfer",
      direction: "in",
      label: `Transfer dari ${names.get(x.from_account_id) || "dompet lain"}`,
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, limit);
  const balance = await getAccountBalance(ctx, accountId);
  return { ok: true, account: balance, transactions };
}

async function deleteAccount(ctx: HandlerCtx, args: any) {
  if (args.confirm_account_id) {
    const { data, error } = await ctx.supabase
      .from("accounts")
      .delete()
      .eq("id", args.confirm_account_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }

  let query = ctx.supabase.from("accounts").select("id, name, starting_balance").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("name", `%${args.keyword}%`);

  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };

  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada dompet yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function getNetWorth(ctx: HandlerCtx) {
  const [accountResult, incomeResult, expenseResult] = await Promise.all([
    ctx.supabase.from("accounts").select("current_balance,starting_balance").eq("user_id", ctx.userId),
    ctx.supabase.from("incomes").select("amount").eq("user_id", ctx.userId),
    ctx.supabase.from("expenses").select("amount").eq("user_id", ctx.userId),
  ]);
  let accounts: any[] = accountResult.data ?? [];
  if (accountResult.error) {
    const legacy = await ctx.supabase.from("accounts").select("starting_balance").eq("user_id", ctx.userId);
    accounts = legacy.data ?? [];
  }
  const incomes = incomeResult.data;
  const expenses = expenseResult.data;
  const totalBalance = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance ?? a.starting_balance ?? 0), 0);
  const totalIncome = (incomes ?? []).reduce((s, i) => s + Number(i.amount), 0);
  const totalExpense = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const netWorth = totalBalance;
  return { ok: true, net_worth: netWorth, total_income_all_time: totalIncome, total_expense_all_time: totalExpense };
}

// ---- Fase 4: Target, Catatan, Bacaan, Relasi, Rutinitas ---------------------------

async function createGoal(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("goals")
    .insert({
      user_id: ctx.userId,
      title: args.title,
      description: args.description ?? null,
      target_date: args.target_date ?? null,
      category: args.category ?? null,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, goal: data };
}

async function getGoals(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("goals")
    .select("id, title, description, target_date, progress, status")
    .eq("user_id", ctx.userId);
  if (args.status && args.status !== "all") query = query.eq("status", args.status);
  else if (!args.status) query = query.neq("status", "abandoned");
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, goals: data };
}

async function updateGoal(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (args.progress !== undefined) {
    patch.progress = args.progress;
    if (args.progress >= 100) patch.status = "achieved";
  }
  if (args.status) patch.status = args.status;
  if (args.title) patch.title = args.title;
  if (args.target_date !== undefined) patch.target_date = args.target_date;
  if (args.category !== undefined) patch.category = args.category;

  const { data, error } = await ctx.supabase
    .from("goals")
    .update(patch)
    .eq("id", args.goal_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, goal: data };
}

async function deleteGoal(ctx: HandlerCtx, args: any) {
  if (args.confirm_goal_id) {
    const { data, error } = await ctx.supabase
      .from("goals")
      .delete()
      .eq("id", args.confirm_goal_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase.from("goals").select("id, title, progress, status").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("title", `%${args.keyword}%`);
  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada target yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function createNote(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("brain_dump_notes")
    .insert({ user_id: ctx.userId, content: args.content, tags: args.tags ?? [] })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, note: data };
}

async function getNotes(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase.from("brain_dump_notes").select("id, content, tags, created_at").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("content", `%${args.keyword}%`);
  if (args.tag) query = query.contains("tags", [args.tag]);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(30);
  if (error) return { ok: false, error: error.message };
  return { ok: true, notes: data };
}

async function updateNote(ctx: HandlerCtx, args: any) {
  const noteId = String(args.note_id || "").trim();
  if (!isUuid(noteId))
    return {
      ok: false,
      code: "INVALID_ENTITY_ID",
      error:
        "ID catatan tidak valid. Jangan gunakan nomor urut daftar; cari kembali catatan dan gunakan ID hasil tool.",
      retryable: false,
    };
  const patch: Record<string, any> = {};
  if (args.content) patch.content = args.content;
  if (args.tags) patch.tags = args.tags;
  if (args.pinned !== undefined) patch.pinned = args.pinned;
  if (!Object.keys(patch).length)
    return { ok: false, status: "no_changes", message: "Tidak ada perubahan yang diberikan." };

  const { data, error } = await ctx.supabase
    .from("brain_dump_notes")
    .update(patch)
    .eq("id", noteId)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, note: data };
}

async function deleteNote(ctx: HandlerCtx, args: any) {
  if (args.confirm_note_id) {
    const { data, error } = await ctx.supabase
      .from("brain_dump_notes")
      .delete()
      .eq("id", args.confirm_note_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase.from("brain_dump_notes").select("id, content, tags, created_at").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("content", `%${args.keyword}%`);
  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada catatan yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function logReading(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("reading_logs")
    .insert({
      user_id: ctx.userId,
      title: args.title,
      author: args.author ?? null,
      status: args.status ?? "want_to_read",
      genre: args.genre ?? null,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, reading: data };
}

async function getReadingList(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("reading_logs")
    .select("id, title, author, status, progress, rating, notes")
    .eq("user_id", ctx.userId);
  if (args.status && args.status !== "all") query = query.eq("status", args.status);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, reading_list: data };
}

async function updateReading(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (args.progress !== undefined) patch.progress = args.progress;
  if (args.status) patch.status = args.status;
  if (args.rating !== undefined) patch.rating = args.rating;
  if (args.notes !== undefined) patch.notes = args.notes;
  if (args.genre !== undefined) patch.genre = args.genre;
  const { data, error } = await ctx.supabase
    .from("reading_logs")
    .update(patch)
    .eq("id", args.reading_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, reading: data };
}

async function deleteReading(ctx: HandlerCtx, args: any) {
  if (args.confirm_reading_id) {
    const { data, error } = await ctx.supabase
      .from("reading_logs")
      .delete()
      .eq("id", args.confirm_reading_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase.from("reading_logs").select("id, title, author, status").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("title", `%${args.keyword}%`);
  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada buku yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function getProjects(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("projects")
    .select("id,name,description,status,target_date,goal_id,updated_at")
    .eq("user_id", ctx.userId)
    .order("updated_at", { ascending: false });
  if (args.status && args.status !== "all") query = query.eq("status", args.status);
  if (args.keyword) query = query.ilike("name", `%${args.keyword}%`);
  const { data, error } = await query.limit(30);
  if (error) return { ok: false, error: error.message };
  const rows = [];
  for (const p of data ?? []) {
    const { data: taskData } = await ctx.supabase
      .from("tasks")
      .select("id,title,status,due_at,estimated_minutes")
      .eq("user_id", ctx.userId)
      .eq("project_id", p.id)
      .neq("status", "done")
      .limit(15);
    rows.push({ ...p, open_tasks: taskData ?? [] });
  }
  return { ok: true, projects: rows };
}

async function createProject(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("projects")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      description: args.description ?? null,
      target_date: args.target_date ?? null,
      goal_id: args.goal_id ?? null,
      status: "active",
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, project: data };
}

async function updateProject(ctx: HandlerCtx, args: any) {
  const patch: any = {};
  for (const k of ["name", "description", "status", "target_date", "goal_id"])
    if (args[k] !== undefined) patch[k] = args[k] || null;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("projects")
    .update(patch)
    .eq("id", args.project_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, project: data };
}

async function deleteProject(ctx: HandlerCtx, args: any) {
  if (args.confirm_project_id) {
    const { data, error } = await ctx.supabase
      .from("projects")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", args.confirm_project_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, archived: data };
  }
  let query = ctx.supabase
    .from("projects")
    .select("id,name,status,target_date")
    .eq("user_id", ctx.userId)
    .neq("status", "archived");
  if (args.keyword) query = query.ilike("name", `%${args.keyword}%`);
  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, status: "no_match", message: "Tidak ada project yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function getMemories(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("user_memories")
    .select(
      "id,category,memory_key,memory_value,source,enabled,confidence,importance,last_confirmed_at,expires_at,updated_at",
    )
    .eq("user_id", ctx.userId)
    .order("updated_at", { ascending: false });
  if (args.enabled_only) query = query.eq("enabled", true);
  const { data, error } = await query.limit(50);
  if (error) return { ok: false, error: error.message };
  const keyword = String(args.keyword || "")
    .trim()
    .toLowerCase();
  const rows = keyword
    ? (data ?? []).filter((x: any) => `${x.memory_key} ${x.memory_value} ${x.category}`.toLowerCase().includes(keyword))
    : (data ?? []);
  return { ok: true, memories: rows };
}

async function deleteMemory(ctx: HandlerCtx, args: any) {
  if (args.confirm_memory_id) {
    const { data, error } = await ctx.supabase
      .from("user_memories")
      .delete()
      .eq("id", args.confirm_memory_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase
    .from("user_memories")
    .select("id,category,memory_key,memory_value,enabled")
    .eq("user_id", ctx.userId);
  if (args.keyword) query = query.or(`memory_key.ilike.%${args.keyword}%,memory_value.ilike.%${args.keyword}%`);
  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, status: "no_match", message: "Memory tidak ditemukan." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function getVaultItems(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("vault_items")
    .select("id,title,item_type,content,source_url,tags,pinned,updated_at")
    .eq("user_id", ctx.userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (args.item_type && args.item_type !== "all") query = query.eq("item_type", args.item_type);
  const { data, error } = await query.limit(Math.min(10, Math.max(1, Number(args.limit) || 6)));
  if (error) return { ok: false, error: error.message };
  const keyword = String(args.keyword || "")
    .trim()
    .toLowerCase();
  const rows = keyword
    ? (data ?? []).filter((x: any) =>
        `${x.title} ${redactVaultContent(x.content)} ${(x.tags || []).join(" ")} ${x.source_url || ""}`
          .toLowerCase()
          .includes(keyword),
      )
    : (data ?? []);
  return {
    ok: true,
    items: rows.map((x: any) => ({
      id: x.id,
      title: x.title,
      item_type: x.item_type,
      content: redactVaultContent(x.content).slice(0, 1400),
      source_url: x.source_url,
      tags: x.tags,
      pinned: x.pinned,
      updated_at: x.updated_at,
    })),
  };
}

async function getAutomationRules(ctx: HandlerCtx) {
  const { data, error } = await ctx.supabase
    .from("automations")
    .select("id,name,trigger_type,trigger_config,action_type,enabled,last_run_at,last_result,updated_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rules: data ?? [] };
}

async function createVaultItem(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("vault_items")
    .insert({
      user_id: ctx.userId,
      title: args.title,
      item_type: args.item_type ?? "note",
      content: args.content ?? null,
      source_url: args.source_url ?? null,
      tags: Array.isArray(args.tags)
        ? args.tags
            .slice(0, 20)
            .map((x: any) => String(x).trim())
            .filter(Boolean)
        : [],
      pinned: Boolean(args.pinned),
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, item: data };
}

async function updateVaultItem(ctx: HandlerCtx, args: any) {
  if (!args.item_id) return { ok: false, error: "item_id wajib diisi." };
  const patch: any = {};
  for (const k of ["title", "item_type", "content", "source_url", "pinned"])
    if (args[k] !== undefined) patch[k] = args[k];
  if (Array.isArray(args.tags))
    patch.tags = args.tags
      .slice(0, 20)
      .map((x: any) => String(x).trim())
      .filter(Boolean);
  patch.updated_at = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("vault_items")
    .update(patch)
    .eq("id", args.item_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, item: data };
}

async function deleteVaultItem(ctx: HandlerCtx, args: any) {
  if (args.confirm_vault_id) {
    const { data, error } = await ctx.supabase
      .from("vault_items")
      .delete()
      .eq("id", args.confirm_vault_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase.from("vault_items").select("id,title,item_type,pinned").eq("user_id", ctx.userId);
  if (args.keyword) {
    const key = String(args.keyword)
      .replace(/[%,()]/g, " ")
      .trim();
    if (key) query = query.or(`title.ilike.%${key}%,content.ilike.%${key}%`);
  }
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, status: "no_match", message: "Item Vault tidak ditemukan." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function createAutomation(ctx: HandlerCtx, args: any) {
  const allowedTriggers = ["overdue_task", "review_due", "daily_open", "inactivity", "schedule_soon"];
  const allowedActions = ["notify", "suggest_focus", "open_brief"];
  if (!allowedTriggers.includes(args.trigger_type) || !allowedActions.includes(args.action_type))
    return { ok: false, error: "Trigger/action automation tidak valid." };
  const { data, error } = await ctx.supabase
    .from("automations")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      trigger_type: args.trigger_type,
      trigger_config: {
        days: Math.max(1, Number(args.days) || 3),
        ...(args.minutes ? { minutes: Math.min(240, Math.max(5, Number(args.minutes) || 30)) } : {}),
        ...(args.schedule_block_id ? { schedule_block_id: String(args.schedule_block_id) } : {}),
      },
      action_type: args.action_type,
      action_config: {},
      enabled: args.enabled !== false,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, rule: data };
}

async function updateAutomation(ctx: HandlerCtx, args: any) {
  const patch: any = { updated_at: new Date().toISOString() };
  if (args.name !== undefined) patch.name = args.name;
  if (args.trigger_type !== undefined) patch.trigger_type = args.trigger_type;
  if (args.action_type !== undefined) patch.action_type = args.action_type;
  if (args.enabled !== undefined) patch.enabled = Boolean(args.enabled);
  if (args.days !== undefined || args.minutes !== undefined || args.schedule_block_id !== undefined)
    patch.trigger_config = {
      days: Math.max(1, Number(args.days) || 3),
      ...(args.minutes !== undefined ? { minutes: Math.min(240, Math.max(5, Number(args.minutes) || 30)) } : {}),
      ...(args.schedule_block_id ? { schedule_block_id: String(args.schedule_block_id) } : {}),
    };
  const { data, error } = await ctx.supabase
    .from("automations")
    .update(patch)
    .eq("id", args.automation_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, rule: data };
}

async function deleteAutomation(ctx: HandlerCtx, args: any) {
  if (args.confirm_automation_id) {
    const { data, error } = await ctx.supabase
      .from("automations")
      .delete()
      .eq("id", args.confirm_automation_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase
    .from("automations")
    .select("id,name,trigger_type,action_type,enabled")
    .eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("name", `%${args.keyword}%`);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, status: "no_match", message: "Automation tidak ditemukan." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function saveMemory(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("user_memories")
    .insert({
      user_id: ctx.userId,
      category: args.category ?? "preferensi",
      memory_key: args.memory_key,
      memory_value: args.memory_value,
      source: args.source ?? "ai",
      enabled: true,
      confidence: args.confidence == null ? 1 : Math.max(0, Math.min(1, Number(args.confidence))),
      importance: args.importance == null ? 0.5 : Math.max(0, Math.min(1, Number(args.importance))),
      last_confirmed_at: new Date().toISOString(),
      expires_at: args.expires_at || null,
    })
    .select(
      "id,category,memory_key,memory_value,enabled,source,confidence,importance,last_confirmed_at,expires_at,updated_at",
    )
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, memory: data };
}

async function createHabit(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("habits")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      target_per_week: args.target_per_week ?? 7,
      icon: args.icon ?? "✅",
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, habit: data };
}

async function getHabits(ctx: HandlerCtx) {
  const { data: habits, error } = await ctx.supabase
    .from("habits")
    .select("id, name, target_per_week, icon")
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };

  const weekStartDate = dateStrInTimezone(new Date(startOfWeekIsoForTimezone(new Date(), ctx.timezone)), ctx.timezone);
  const todayDate = dateStrInTimezone(new Date(), ctx.timezone);

  const results = [];
  for (const h of habits ?? []) {
    const { data: checkins } = await ctx.supabase
      .from("habit_checkins")
      .select("checkin_date")
      .eq("habit_id", h.id)
      .order("checkin_date", { ascending: false });
    const thisWeekCount = (checkins ?? []).filter(
      (c) => c.checkin_date >= weekStartDate && c.checkin_date <= todayDate,
    ).length;

    // Streak: consecutive calendar dates up to today in the user's timezone.
    let streak = 0;
    const dates = new Set((checkins ?? []).map((c) => c.checkin_date));
    const cursor = new Date(`${todayDate}T12:00:00Z`);
    while (streak < 366) {
      const key = dateStrInTimezone(cursor, ctx.timezone);
      if (!dates.has(key)) break;
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    results.push({
      ...h,
      this_week_checkins: thisWeekCount,
      streak_days: streak,
      recent_checkins: (checkins ?? []).slice(0, 30).map((c: any) => c.checkin_date),
    });
  }
  return { ok: true, habits: results };
}

async function resolveTodayHabitDate(ctx: HandlerCtx, requestedDate: unknown) {
  const today = dateStrInTimezone(new Date(), ctx.timezone);
  const requested = String(requestedDate ?? today).trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    return {
      ok: false as const,
      today,
      requested,
      retryable: false,
      error: "Tanggal check-in harus berformat YYYY-MM-DD.",
    };
  }
  if (requested !== today) {
    return {
      ok: false as const,
      today,
      requested,
      code: "HABIT_CHECKIN_ONLY_TODAY",
      retryable: false,
      error: `Check-in rutinitas hanya bisa untuk hari ini (${today}) menurut timezone ${ctx.timezone}.`,
    };
  }
  return { ok: true as const, today, requested };
}

async function checkinHabit(ctx: HandlerCtx, args: any) {
  const dateResult = await resolveTodayHabitDate(ctx, args.checkin_date);
  if (!dateResult.ok) return dateResult;
  const { data, error } = await ctx.supabase
    .from("habit_checkins")
    .upsert(
      { user_id: ctx.userId, habit_id: args.habit_id, checkin_date: dateResult.today },
      { onConflict: "habit_id,checkin_date" },
    )
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, checkin: data, checkin_date: dateResult.today, idempotent: true };
}

async function uncheckinHabit(ctx: HandlerCtx, args: any) {
  const dateResult = await resolveTodayHabitDate(ctx, args.checkin_date);
  if (!dateResult.ok) return dateResult;
  const { error } = await ctx.supabase
    .from("habit_checkins")
    .delete()
    .eq("habit_id", args.habit_id)
    .eq("checkin_date", dateResult.today)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, uncheckedDate: dateResult.today };
}

async function updateHabit(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = {};
  if (args.name) patch.name = args.name;
  if (args.target_per_week !== undefined) patch.target_per_week = args.target_per_week;
  if (args.icon) patch.icon = args.icon;

  const { data, error } = await ctx.supabase
    .from("habits")
    .update(patch)
    .eq("id", args.habit_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, habit: data };
}

async function deleteHabitsBulk(ctx: HandlerCtx, args: any) {
  let query = ctx.supabase
    .from("habits")
    .select("id,name,target_per_week,icon")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });

  const keyword = String(args.keyword ?? "").trim();
  const requestedIds = Array.isArray(args.habit_ids)
    ? args.habit_ids
        .map((value: unknown) => String(value).trim())
        .filter((value: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
        )
        .slice(0, 1000)
    : [];
  if (requestedIds.length) query = query.in("id", requestedIds);
  if (keyword) query = query.ilike("name", "%" + keyword.replace(/[%_]/g, "\\$&") + "%");

  const { data, error } = await query.limit(1000);
  if (error) return { ok: false, error: error.message };

  const targets = data ?? [];
  if (!targets.length) {
    return {
      ok: true,
      status: "no_match",
      count: 0,
      deleted: [],
      message: keyword
        ? 'Tidak ada rutinitas yang cocok dengan "' + keyword + '".'
        : "Tidak ada rutinitas yang tersimpan.",
    };
  }

  if (args.confirm_all !== true) {
    return {
      ok: true,
      status: "confirmation_required",
      code: "HABIT_BULK_DELETE_CONFIRM",
      requires_confirmation: true,
      target_count: targets.length,
      targets,
      message: keyword
        ? "Ada " + targets.length + ' rutinitas yang cocok dengan "' + keyword + '" dan akan dihapus.'
        : "Ada " + targets.length + " rutinitas yang akan dihapus.",
    };
  }

  const ids = targets.map((row: any) => String(row.id)).filter(Boolean);
  const { data: deleted, error: deleteError } = await ctx.supabase
    .from("habits")
    .delete()
    .in("id", ids)
    .eq("user_id", ctx.userId)
    .select("id,name,target_per_week,icon");

  if (deleteError) return { ok: false, error: deleteError.message, retryable: true };

  const actual = deleted?.length ?? 0;
  return {
    ok: true,
    status: actual === ids.length ? "completed" : "partial",
    operation: "bulk_delete_habits",
    count: actual,
    requested_count: ids.length,
    deleted: deleted ?? [],
  };
}

async function deleteHabit(ctx: HandlerCtx, args: any) {
  if (args.confirm_habit_id) {
    const { data, error } = await ctx.supabase
      .from("habits")
      .delete()
      .eq("id", args.confirm_habit_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }
  let query = ctx.supabase.from("habits").select("id, name").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("name", `%${args.keyword}%`);
  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada kebiasaan yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

// ---- Langganan (menggantikan Anime/Manga — lebih berguna sehari-hari) ------------

function monthlyEquivalent(amount: number, cycle: string) {
  return cycle === "yearly" ? amount / 12 : amount;
}

async function createSubscription(ctx: HandlerCtx, args: any) {
  const { data, error } = await ctx.supabase
    .from("subscriptions")
    .insert({
      user_id: ctx.userId,
      name: args.name,
      amount: args.amount,
      billing_cycle: args.billing_cycle ?? "monthly",
      next_billing_date: args.next_billing_date ?? null,
      category: args.category ?? null,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, subscription: data };
}

async function getSubscriptions(ctx: HandlerCtx) {
  const { data, error } = await ctx.supabase
    .from("subscriptions")
    .select("id, name, amount, billing_cycle, next_billing_date, category, active")
    .eq("user_id", ctx.userId)
    .eq("active", true)
    .order("next_billing_date", { ascending: true, nullsFirst: false });
  if (error) return { ok: false, error: error.message };

  const totalMonthly = (data ?? []).reduce((s, sub) => s + monthlyEquivalent(Number(sub.amount), sub.billing_cycle), 0);
  return { ok: true, subscriptions: data, total_monthly_equivalent: Math.round(totalMonthly) };
}

async function updateSubscription(ctx: HandlerCtx, args: any) {
  const patch: Record<string, any> = {};
  if (args.name) patch.name = args.name;
  if (args.amount !== undefined) patch.amount = args.amount;
  if (args.billing_cycle) patch.billing_cycle = args.billing_cycle;
  if (args.next_billing_date !== undefined) patch.next_billing_date = args.next_billing_date;
  if (args.active !== undefined) patch.active = args.active;

  const { data, error } = await ctx.supabase
    .from("subscriptions")
    .update(patch)
    .eq("id", args.subscription_id)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, subscription: data };
}

async function deleteSubscription(ctx: HandlerCtx, args: any) {
  if (args.confirm_subscription_id) {
    const { data, error } = await ctx.supabase
      .from("subscriptions")
      .delete()
      .eq("id", args.confirm_subscription_id)
      .eq("user_id", ctx.userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, deleted: data };
  }

  let query = ctx.supabase.from("subscriptions").select("id, name, amount, billing_cycle").eq("user_id", ctx.userId);
  if (args.keyword) query = query.ilike("name", `%${args.keyword}%`);

  const { data, error } = await query.limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: true, status: "no_match", message: "Tidak ada langganan yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function getNotifications(ctx: HandlerCtx, args: any) {
  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
  let query: any = ctx.supabase
    .from("notification_events")
    .select("id,title,body,href,tone,source_type,source_id,scheduled_at,delivered_at,read_at,created_at")
    .eq("user_id", ctx.userId);
  if (args.unread_only === true) query = query.is("read_at", null);
  if (args.keyword) {
    const keyword = String(args.keyword).trim().replace(/[\%_]/g, "\\$&");
    if (keyword) query = query.or(`title.ilike.%${keyword}%,body.ilike.%${keyword}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, notifications: data ?? [], count: data?.length ?? 0 };
}

async function deleteNotification(ctx: HandlerCtx, args: any) {
  const confirmId = String(args.confirm_notification_id || "").trim();
  if (confirmId) {
    const { data, error } = await ctx.supabase
      .from("notification_events")
      .delete()
      .eq("id", confirmId)
      .eq("user_id", ctx.userId)
      .select("id,title,body,created_at")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, status: "not_found", error: "Notifikasi tidak ditemukan." };
    return { ok: true, deleted: data };
  }
  let query: any = ctx.supabase
    .from("notification_events")
    .select("id,title,body,read_at,created_at")
    .eq("user_id", ctx.userId);
  if (args.keyword) {
    const keyword = String(args.keyword).trim().replace(/[\%_]/g, "\\$&");
    if (keyword) query = query.or(`title.ilike.%${keyword}%,body.ilike.%${keyword}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, status: "no_match", message: "Tidak ada notifikasi yang cocok." };
  if (data.length > 1) return { ok: true, status: "multiple_candidates", candidates: data };
  return { ok: true, status: "single_candidate_needs_confirmation", candidate: data[0] };
}

async function deleteAllNotifications(ctx: HandlerCtx, args: any) {
  const { count, error: countError } = await ctx.supabase
    .from("notification_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId);
  if (countError) return { ok: false, error: countError.message };
  const total = Number(count ?? 0);
  if (args.confirm !== true)
    return {
      ok: true,
      status: "confirmation_required",
      code: "NOTIFICATION_HISTORY_DELETE_CONFIRM",
      count: total,
      message: total
        ? `Ada ${total} riwayat notifikasi yang akan dihapus.`
        : "Tidak ada riwayat notifikasi untuk dihapus.",
    };
  if (!total) return { ok: true, deleted: 0, message: "Tidak ada riwayat notifikasi." };
  const { error } = await ctx.supabase.from("notification_events").delete().eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, deleted: total, message: `${total} riwayat notifikasi berhasil dihapus.` };
}

async function markNotificationRead(ctx: HandlerCtx, args: any) {
  const id = String(args.notification_id || "").trim();
  if (!id) return { ok: false, error: "notification_id wajib diisi." };
  const { data, error } = await ctx.supabase
    .from("notification_events")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("id,read_at")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, status: "not_found", error: "Notifikasi tidak ditemukan." };
  return { ok: true, notification: data };
}

async function searchLifeOs(ctx: HandlerCtx, args: any) {
  const keyword = String(args.keyword || "").trim();
  if (keyword.length < 2) return { ok: false, error: "Kata kunci pencarian terlalu pendek." };
  const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
  const like = `%${keyword.replace(/[%_]/g, "\\$&")}%`;
  try {
    const queries = [
      ["tasks", "id,title,status,priority,due_at,project_id", `title.ilike.${like}`],
      ["schedule_blocks", "id,title,block_date,start_time,end_time,task_id,project_id", `title.ilike.${like}`],
      ["projects", "id,name,status,target_date,goal_id", `name.ilike.${like}`],
      ["goals", "id,title,status,progress,target_date,next_step", `title.ilike.${like}`],
      ["brain_dump_notes", "id,title,content,updated_at", `title.ilike.${like},content.ilike.${like}`],
      ["smart_inbox_items", "id,content,kind,status,created_at", `content.ilike.${like}`],
      ["decisions", "id,title,decision,outcome,review_date", `title.ilike.${like},decision.ilike.${like}`],
      ["habits", "id,name,target_per_week", `name.ilike.${like}`],
      ["subscriptions", "id,name,amount,billing_cycle,next_billing_date,active", `name.ilike.${like}`],
      ["user_memories", "id,memory_key,memory_value,enabled", `memory_key.ilike.${like},memory_value.ilike.${like}`],
      ["vault_items", "id,title,content,item_type,tags,pinned", `title.ilike.${like},content.ilike.${like}`],
      ["skills", "id,name,level,next_action,target_date", `name.ilike.${like}`],
      ["reading_logs", "id,title,status,progress,rating", `title.ilike.${like}`],
    ] as const;
    const results = await Promise.all(
      queries.map(async ([table, select, filter]) => {
        const { data, error } = await ctx.supabase
          .from(table)
          .select(select)
          .eq("user_id", ctx.userId)
          .or(filter)
          .limit(limit);
        return error ? { module: table, items: [], error: error.message } : { module: table, items: data ?? [] };
      }),
    );
    const compact = results.filter((x) => x.items.length || x.error);
    return { ok: true, keyword, modules: compact };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Pencarian Life OS gagal." };
  }
}

async function getUnifiedLifeSnapshot(ctx: HandlerCtx, args: any = {}) {
  const snapshotLimit = Math.min(30, Math.max(4, Number(args.limit) || 8));
  const safe = async (table: string, select: string, order = "updated_at") => {
    try {
      let q: any = ctx.supabase.from(table).select(select).eq("user_id", ctx.userId).limit(snapshotLimit);
      if (order) q = q.order(order, { ascending: false });
      return (await q).data ?? [];
    } catch {
      return [];
    }
  };
  const [
    tasks,
    schedule,
    projects,
    goals,
    notes,
    inbox,
    focus,
    habits,
    skills,
    reading,
    expenses,
    incomes,
    subscriptions,
    memories,
    vault,
    automations,
    reminders,
    notificationEvents,
    decisions,
    journal,
    relations,
    interactions,
    accounts,
    budgets,
    healthMetrics,
    dailyPlans,
    readingSessions,
    sleep,
    hydration,
    caffeine,
    meals,
    medications,
    fatigue,
    movement,
    anime,
  ] = await Promise.all([
    safe("tasks", "id,title,status,priority,due_at,estimated_minutes,project_id,area_id", "due_at"),
    safe(
      "schedule_blocks",
      "id,title,block_date,start_time,end_time,location,description,task_id,project_id",
      "block_date",
    ),
    safe("projects", "id,name,status,target_date,goal_id,area_id", "updated_at"),
    safe("goals", "id,title,progress,status,target_date,next_step,description", "updated_at"),
    safe("brain_dump_notes", "id,title,content,tags,pinned,updated_at", "updated_at"),
    safe("smart_inbox_items", "id,content,kind,status,created_at,processed_at", "created_at"),
    safe("pomodoro_sessions", "id,task_id,focus_minutes,started_at,completed", "started_at"),
    safe("habits", "id,name,target_per_week,icon", "created_at"),
    safe("skills", "id,name,level,next_action,target_date", "updated_at"),
    safe("reading_logs", "id,title,status,progress,rating", "updated_at"),
    safe("expenses", "id,amount,category,note,occurred_at,account_id", "occurred_at"),
    safe("incomes", "id,amount,source,note,occurred_at,account_id", "occurred_at"),
    safe("subscriptions", "id,name,amount,billing_cycle,next_billing_date,active", "next_billing_date"),
    safe("user_memories", "id,category,memory_key,memory_value,enabled,updated_at", "updated_at"),
    safe("vault_items", "id,title,item_type,content,tags,pinned,updated_at", "updated_at"),
    safe("automations", "id,name,trigger_type,action_type,enabled,last_run_at,last_result", "created_at"),
    safe(
      "reminders",
      "id,title,body,remind_at,href,target_type,target_id,offset_minutes,enabled,status,sent_at,updated_at",
      "remind_at",
    ),
    safe(
      "notification_events",
      "id,title,body,href,tone,source_type,source_id,scheduled_at,delivered_at,read_at,created_at",
      "created_at",
    ),
    safe("decisions", "id,title,decision,review_date,outcome,updated_at", "updated_at"),
    safe("journal_entries", "id,mood_score,content,created_at", "created_at"),
    safe(
      "social_relations",
      "id,contact_name,importance,contact_frequency_days,birthday,notes,created_at",
      "created_at",
    ),
    safe("social_interactions", "id,relation_id,note,occurred_at", "occurred_at"),
    safe("accounts", "id,name,starting_balance,created_at", "created_at"),
    safe("budgets", "id,category,limit_amount,period,created_at", "created_at"),
    safe("health_metrics", "id,weight_kg,systolic,diastolic,resting_hr,note,measured_at", "measured_at"),
    safe("daily_plans", "id,week_start,plan,created_at", "week_start"),
    safe("reading_sessions", "id,reading_id,minutes,pages_read,note,started_at,created_at", "started_at"),
    safe("sleep_logs", "id,sleep_start,sleep_end,quality,created_at", "sleep_end"),
    safe("hydration_logs", "id,amount_ml,logged_at", "logged_at"),
    safe("caffeine_logs", "id,drink,mg_estimate,logged_at", "logged_at"),
    safe("meal_logs", "id,meal_type,description,logged_at", "logged_at"),
    safe("medication_logs", "id,medication_name,dosage,logged_at", "logged_at"),
    safe("fatigue_logs", "id,fatigue_score,note,logged_at", "logged_at"),
    safe("movement_logs", "id,activity,duration_minutes,intensity,note,logged_at", "logged_at"),
    safe("anime_watchlist", "id,title,status,watched_episodes,total_episodes,score,updated_at", "updated_at"),
  ]);
  const open = tasks.filter((x: any) => x.status !== "done");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: ctx.timezone });
  const agenda = schedule.filter((x: any) => String(x.block_date) >= today);
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    timezone: ctx.timezone,
    summary: {
      open_tasks: open.length,
      upcoming_agenda: agenda.length,
      active_projects: projects.filter((x: any) => !["archived", "completed"].includes(String(x.status))).length,
      active_goals: goals.filter((x: any) => x.status === "active").length,
      focus_minutes_recent: focus.reduce((n: number, x: any) => n + Number(x.focus_minutes || 0), 0),
      recent_income: incomes.reduce((n: number, x: any) => n + Number(x.amount || 0), 0),
      recent_expense: expenses.reduce((n: number, x: any) => n + Number(x.amount || 0), 0),
      open_inbox: inbox.filter((x: any) => x.status === "open").length,
      memory_count: memories.filter((x: any) => x.enabled !== false).length,
      pending_reminders: reminders.filter(
        (x: any) => x.enabled !== false && ["pending", "waiting_for_device", "failed"].includes(x.status),
      ).length,
      unread_notifications: notificationEvents.filter((x: any) => !x.read_at).length,
      relation_count: relations.length,
      journal_entries: journal.length,
    },
    modules: {
      tasks: open,
      schedule: agenda,
      projects,
      goals,
      notes,
      inbox,
      focus,
      habits,
      skills,
      reading,
      expenses,
      incomes,
      subscriptions,
      memories,
      vault,
      automations,
      reminders,
      notification_events: notificationEvents,
      decisions,
      journal,
      relations,
      interactions,
      accounts,
      budgets,
      health_metrics: healthMetrics,
      daily_plans: dailyPlans,
      reading_sessions: readingSessions,
      sleep,
      hydration,
      caffeine,
      meals,
      medications,
      fatigue,
      movement,
      anime,
    },
  };
}

export const toolHandlers: Record<string, (ctx: HandlerCtx, args: any) => any> = {
  log_expense: logExpense,
  get_expense_summary: getExpenseSummary,
  delete_expense: deleteExpense,
  log_expenses_batch: logExpensesBatch,
  update_expense: updateExpense,
  get_notifications: getNotifications,
  delete_notification: deleteNotification,
  delete_all_notifications: deleteAllNotifications,
  mark_notification_read: markNotificationRead,
  get_life_graph: getLifeGraph,
  get_life_module_data: getLifeModuleData,
  manage_life_os_data: manageLifeOsData,
  create_task_from_inbox: createTaskFromInbox,
  create_task_from_note: createTaskFromNote,
  create_task_from_project: createTaskFromProject,
  create_task_from_goal: createTaskFromGoal,
  create_schedule_from_task: createScheduleFromTask,
  create_schedule_reminder: createScheduleReminder,
  create_reminder: createReminder,
  get_reminders: getReminders,
  update_reminder: updateReminder,
  delete_reminder: deleteReminder,
  delete_all_reminders: deleteAllReminders,
  create_task_with_subtasks: createTaskWithSubtasks,
  create_task_from_schedule: createTaskFromSchedule,
  get_tasks: getTasks,
  update_task: updateTask,
  update_tasks_bulk: updateTasksBulk,
  delete_task: deleteTask,
  delete_tasks_bulk: deleteTasksBulk,
  delete_subtask: deleteSubtask,
  log_pomodoro_session: logPomodoro,
  get_pomodoro_sessions: getPomodoroSessions,
  delete_pomodoro_session: deletePomodoroSession,
  create_daily_schedule: createDailySchedule,
  update_schedule_block: updateScheduleBlock,
  resolve_calendar_date: resolveCalendarDate,
  get_schedule: getSchedule,
  delete_schedule_block: deleteScheduleBlock,
  delete_schedule_blocks_bulk: deleteScheduleBlocksBulk,
  capture_inbox_item: captureInboxItem,
  get_decisions: getDecisions,
  log_decision: logDecision,
  update_decision: updateDecision,
  delete_decision: deleteDecision,
  get_skills: getSkills,
  create_skill: createSkill,
  delete_skill: deleteSkill,
  update_skill: updateSkill,
  get_task_dependencies: getTaskDependencies,
  create_task_dependency: createTaskDependency,
  delete_task_dependency: deleteTaskDependency,
  get_daily_brain: getDailyBrain,
  simulate_planner: simulatePlanner,
  get_ai_watchers: getAiWatchers,
  create_ai_watcher: createAiWatcher,
  update_ai_watcher: updateAiWatcher,
  delete_ai_watcher: deleteAiWatcher,
  get_today_overview: getTodayOverview,
  get_life_snapshot: getLifeSnapshot,
  search_life_os: searchLifeOs,
  get_unified_life_snapshot: getUnifiedLifeSnapshot,
  log_income: logIncome,
  delete_income: deleteIncome,
  get_incomes: getIncomes,
  update_income: updateIncome,
  create_budget: createBudget,
  update_budget: updateBudget,
  delete_budget: deleteBudget,
  get_budgets: getBudgets,
  log_health: logHealth,
  get_health_summary: getHealthSummary,
  delete_health_log: deleteHealthLog,
  create_account: createAccount,
  get_accounts: getAccounts,
  update_account: updateAccount,
  delete_account: deleteAccount,
  transfer_money: transferMoney,
  get_account_transactions: getAccountTransactions,
  get_net_worth: getNetWorth,
  create_goal: createGoal,
  get_goals: getGoals,
  update_goal: updateGoal,
  delete_goal: deleteGoal,
  create_note: createNote,
  get_notes: getNotes,
  update_note: updateNote,
  delete_note: deleteNote,
  log_reading: logReading,
  get_reading_list: getReadingList,
  update_reading: updateReading,
  delete_reading: deleteReading,
  get_projects: getProjects,
  create_project: createProject,
  update_project: updateProject,
  delete_project: deleteProject,
  get_memories: getMemories,
  delete_memory: deleteMemory,
  get_vault_items: getVaultItems,
  create_vault_item: createVaultItem,
  update_vault_item: updateVaultItem,
  delete_vault_item: deleteVaultItem,
  get_automation_rules: getAutomationRules,
  create_automation: createAutomation,
  update_automation: updateAutomation,
  delete_automation: deleteAutomation,
  save_memory: saveMemory,
  create_habit: createHabit,
  get_habits: getHabits,
  update_habit: updateHabit,
  checkin_habit: checkinHabit,
  uncheckin_habit: uncheckinHabit,
  delete_habit: deleteHabit,
  delete_habits_bulk: deleteHabitsBulk,
  create_subscription: createSubscription,
  get_subscriptions: getSubscriptions,
  update_subscription: updateSubscription,
  delete_subscription: deleteSubscription,
  get_life_os_capabilities: (_ctx, args) =>
    getLifeOsCapabilities({ domain: args?.domain, includeFields: args?.include_fields === true }),
};

export { toolDefs };

/** Backward-compatible entry point; new code should import from toolExecutor. */
export async function executeTool(ctx: HandlerCtx, name: string, rawArgs: string): Promise<any> {
  const { executeTool: run } = await import("@/lib/ai/toolExecutor");
  return run(ctx, name, rawArgs);
}
