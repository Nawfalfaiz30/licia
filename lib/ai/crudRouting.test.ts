import { describe, expect, it } from "vitest";
import { buildConversationDecision } from "@/lib/ai/conversationIntelligence";
import { selectToolDefs } from "@/lib/ai/toolRouting";

const defs = [
  ...["get_habits", "delete_habit", "delete_habits_bulk"].map((name) => ({ type: "function", function: { name } })),
  ...[
    "get_tasks",
    "delete_tasks_bulk",
    "get_schedule",
    "delete_schedule_blocks_bulk",
    "get_reminders",
    "delete_all_reminders",
    "get_notifications",
    "delete_all_notifications",
  ].map((name) => ({ type: "function", function: { name } })),
];

describe("AI CRUD routing", () => {
  it('exposes collection delete tools for an ambiguous "hapus semua" request', () => {
    const selected = selectToolDefs(defs, ["overview"], "Hapus semua");
    const names = selected.map((def) => def.function?.name);
    expect(names).toContain("delete_habits_bulk");
    expect(names).toContain("get_habits");
  });

  it("recovers habits/delete intent from an assistant confirmation question", () => {
    const decision = buildConversationDecision({
      message: "Iya",
      state: {
        activeDomain: "overview",
        activeOperation: "read",
        activeEntityIds: [],
        activeLabels: [],
        lastUserText: "Hapus semua",
        lastActionTools: [],
        updatedAt: Date.now(),
      },
      recentAssistantText: "Konfirmasi: hapus semua 6 rutinitas ini?",
    });
    expect(decision.currentOperation).toBe("delete");
    expect(decision.mutationExpected).toBe(true);
    expect(decision.effectiveDomains).toContain("habits");
  });
});
