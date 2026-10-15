import { describe, expect, it, vi } from "vitest";
import { distributedExternalRateLimit, distributedRateLimit } from "@/lib/security";

const mutableEnv = process.env as Record<string, string | undefined>;

describe("distributedRateLimit", () => {
  it("fails closed in production when the database limiter is unavailable", async () => {
    const previousNodeEnv = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      const supabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } }),
      } as any;
      const response = await distributedRateLimit(supabase, "test-ai", 2, 60_000, "test-ai-fallback", {
        failClosed: true,
      });
      expect(response?.status).toBe(503);
      expect(response?.headers.get("retry-after")).toBe("30");
    } finally {
      if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = previousNodeEnv;
    }
  });

  it("returns the database rejection response when the shared limit is exceeded", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: { allowed: false, retry_after_seconds: 17 },
        error: null,
      }),
    } as any;
    const response = await distributedRateLimit(supabase, "test-ai-denied", 2, 60_000);
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("17");
  });

  it("does not treat an invalid database response as permission in production", async () => {
    const previousNodeEnv = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      const supabase = { rpc: vi.fn().mockResolvedValue({ data: {}, error: null }) } as any;
      const response = await distributedRateLimit(supabase, "test-ai-invalid", 2, 60_000, "fallback", {
        failClosed: true,
      });
      expect(response?.status).toBe(503);
    } finally {
      if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = previousNodeEnv;
    }
  });

  it("fails closed for external token limits if their database RPC is missing", async () => {
    const previousNodeEnv = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } }) } as any;
      const response = await distributedExternalRateLimit(supabase, "a".repeat(64), 10, 60_000, "fallback");
      expect(response?.status).toBe(503);
    } finally {
      if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = previousNodeEnv;
    }
  });
});
