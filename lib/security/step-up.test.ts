import { describe, expect, it } from "vitest";
import {
  STEP_UP_WINDOW_MS,
  buildStepUpUrl,
  isRecentStepUp,
  latestMfaTimestamp,
  safeStepUpNextPath,
  syncMutationRequiresStepUp,
  toolRequiresStepUp,
} from "./step-up";

describe("step-up security policy", () => {
  it("uses the most recent MFA timestamp from AMR", () => {
    expect(
      latestMfaTimestamp([
        { method: "password", timestamp: 100 },
        { method: "totp", timestamp: 200 },
        { method: "totp", timestamp: 250 },
      ]),
    ).toBe(250_000);
  });

  it("accepts recent aal2 TOTP and rejects stale or aal1 sessions", () => {
    const now = 1_000_000;
    expect(isRecentStepUp("aal2", 995_000, now)).toBe(true);
    expect(isRecentStepUp("aal2", now - STEP_UP_WINDOW_MS - 1, now)).toBe(false);
    expect(isRecentStepUp("aal1", now, now)).toBe(false);
  });

  it("rejects open redirects", () => {
    expect(safeStepUpNextPath("/settings?tab=data")).toBe("/settings?tab=data");
    expect(safeStepUpNextPath("https://evil.example/steal")).toBe("/chat");
    expect(safeStepUpNextPath("//evil.example/steal")).toBe("/chat");
    expect(safeStepUpNextPath("/\\\\evil.example")).toBe("/chat");
  });

  it("marks only high-impact AI and sync mutations for step-up", () => {
    expect(toolRequiresStepUp("transfer_money")).toBe(true);
    expect(toolRequiresStepUp("delete_vault_item")).toBe(true);
    expect(toolRequiresStepUp("update_task")).toBe(false);
    expect(syncMutationRequiresStepUp("vault", "update")).toBe(true);
    expect(syncMutationRequiresStepUp("accountTransfer", "create")).toBe(true);
    expect(syncMutationRequiresStepUp("account", "delete")).toBe(true);
    expect(syncMutationRequiresStepUp("account", "update")).toBe(false);
    expect(syncMutationRequiresStepUp("task", "update")).toBe(false);
  });

  it("builds an encoded step-up URL", () => {
    expect(buildStepUpUrl("/settings?tab=data")).toBe("/step-up?next=%2Fsettings%3Ftab%3Ddata");
  });
});
