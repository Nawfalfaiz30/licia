import { describe, it, expect } from "vitest";
import { buildOnboardingSteps, nextStep, onboardingProgress } from "@/lib/onboarding";

const empty = { displayName: false, goal: false, project: false, task: false, finance: false, habit: false };

describe("onboarding checklist", () => {
  it("5 langkah dan semuanya belum selesai di akun baru", () => {
    const steps = buildOnboardingSteps(empty);
    expect(steps).toHaveLength(5);
    expect(onboardingProgress(steps)).toEqual({ done: 0, total: 5, percent: 0, complete: false });
    expect(nextStep(steps)?.id).toBe("name");
  });
  it("target ATAU proyek menuntaskan langkah arah", () => {
    expect(buildOnboardingSteps({ ...empty, project: true }).find((s) => s.id === "direction")?.done).toBe(true);
    expect(buildOnboardingSteps({ ...empty, goal: true }).find((s) => s.id === "direction")?.done).toBe(true);
  });
  it("catatan opsional di API lama → dianggap belum", () => {
    expect(buildOnboardingSteps(empty).find((s) => s.id === "note")?.done).toBe(false);
  });
  it("selesai penuh", () => {
    const steps = buildOnboardingSteps({ displayName: true, goal: true, project: false, task: true, finance: true, habit: false, note: true });
    expect(onboardingProgress(steps).complete).toBe(true);
    expect(nextStep(steps)).toBeNull();
  });
  it("langkah bercontoh membawa mode dan teks", () => {
    const money = buildOnboardingSteps(empty).find((s) => s.id === "money")!;
    expect(money.example?.text).toContain("25k");
  });
});
