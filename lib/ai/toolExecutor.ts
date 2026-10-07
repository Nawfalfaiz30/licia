import { toolDefs } from "@/lib/ai/toolDefinitions";
import { isUuid, toolHandlers, type HandlerCtx } from "@/lib/ai/tools";
import { validateToolArguments } from "@/lib/ai/toolValidation";
import { getStepUpState, stepUpToolResponse, toolRequiresStepUp } from "@/lib/security/step-up";

export async function executeTool(ctx: HandlerCtx, name: string, rawArgs: string): Promise<any> {
  let args: any = {};
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return { ok: false, code: "INVALID_TOOL_ARGUMENTS", error: "Argumen tool tidak valid (bukan JSON)." };
  }
  const validation = validateToolArguments(toolDefs as any, name, args);
  if (!validation.ok) return validation;
  args = validation.value;
  const idFieldByMutationTool: Record<string, string> = {
    update_expense: "expense_id",
    update_task: "task_id",
    update_income: "income_id",
    update_account: "account_id",
    update_schedule_block: "block_id",
    update_reminder: "reminder_id",
    update_decision: "decision_id",
    update_skill: "skill_id",
    update_budget: "budget_id",
    update_goal: "goal_id",
    update_note: "note_id",
    update_reading: "reading_id",
    update_project: "project_id",
    update_vault_item: "item_id",
    update_automation: "automation_id",
    update_habit: "habit_id",
    update_subscription: "subscription_id",
    mark_notification_read: "notification_id",
    checkin_habit: "habit_id",
    uncheckin_habit: "habit_id",
  };
  const idField = idFieldByMutationTool[name];
  if (idField && args[idField] !== undefined && args[idField] !== null && !isUuid(args[idField])) {
    return {
      ok: false,
      code: "INVALID_ENTITY_ID",
      error: String(idField) + " harus berupa UUID nyata dari hasil baca/search, bukan nomor urut.",
    };
  }
  if (toolRequiresStepUp(name)) {
    const stepUp = await getStepUpState(ctx.supabase);
    if (stepUp.status === "unavailable") {
      return {
        ok: false,
        code: "STEP_UP_UNAVAILABLE",
        error: "Verifikasi keamanan tambahan sedang tidak tersedia. Coba lagi sebentar.",
      };
    }
    if (stepUp.status !== "fresh") return stepUpToolResponse("/chat");
  }

  const handler = toolHandlers[name];
  if (!handler) return { ok: false, error: "Tool tidak dikenal: " + name };
  return await handler(ctx, args);
}
