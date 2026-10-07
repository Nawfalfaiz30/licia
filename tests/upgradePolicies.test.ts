import { describe, it, expect } from "vitest";
import { shouldProactivelyNotify, isWithinQuietHours } from "@/lib/ai/proactivePolicy";
import { assertToolRegistryHealthy, getStrictToolDefs } from "@/lib/ai/toolSchema";
import { CORE_MODULES, legacyRedirect, coreModuleFromPath } from "@/lib/coreMode";

describe("upgrade policies", () => {
  it("keeps the Core Mode focused on six default modules", () => {
    expect(CORE_MODULES).toEqual(["today", "chat", "tasks", "calendar", "notes", "finance"]);
    expect(coreModuleFromPath("/chat")).toBe("chat");
    expect(coreModuleFromPath("/finance/accounts")).toBe("finance");
    expect(legacyRedirect("/pomodoro")).toBe("/focus");
  });

  it("enforces quiet hours and a daily proactive limit", () => {
    expect(
      isWithinQuietHours(new Date("2026-10-07T22:30:00"), {
        quiet_start: "22:00",
        quiet_end: "07:00",
      }),
    ).toBe(true);
    expect(
      shouldProactivelyNotify({
        suggestionsToday: 3,
        candidateScore: 95,
        prefs: { max_suggestions_per_day: 3 },
        quietHours: false,
      }).allowed,
    ).toBe(false);
  });

  it("has a healthy unique tool registry and can strictify schemas", () => {
    const health = assertToolRegistryHealthy();
    expect(health.ok).toBe(true);
    expect(health.count).toBeGreaterThan(0);
    const strict = getStrictToolDefs();
    expect(strict.length).toBe(health.count);
    expect(strict.every((x) => x.function?.strict === true)).toBe(true);
  });
});
