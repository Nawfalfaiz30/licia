import assert from "node:assert/strict";

function mutationApplied(tool, result) {
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

assert.equal(
  mutationApplied("delete_schedule_block", {
    ok: true,
    status: "single_candidate_needs_confirmation",
    candidate: { id: "1" },
  }),
  false,
);
assert.equal(
  mutationApplied("delete_schedule_blocks_bulk", {
    ok: true,
    status: "confirmation_required",
    requires_confirmation: true,
    target_count: 8,
  }),
  false,
);
assert.equal(mutationApplied("delete_schedule_blocks_bulk", { ok: true, status: "completed", count: 8 }), true);
assert.equal(mutationApplied("delete_schedule_blocks_bulk", { ok: true, status: "no_changes", count: 0 }), false);
assert.equal(mutationApplied("delete_task", { ok: true, deleted: { id: "1" } }), true);
assert.equal(mutationApplied("update_task", { ok: true, task: { id: "1" } }), true);
assert.equal(mutationApplied("create_daily_schedule", { ok: true, status: "partial", created: 2 }), true);
assert.equal(mutationApplied("create_daily_schedule", { ok: true, status: "no_changes", created: 0 }), false);
console.log("CRUD behavior tests passed — candidate previews are not treated as applied mutations.");
