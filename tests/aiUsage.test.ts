import { afterEach, describe, expect, it } from "vitest";
import { dailyTokenLimit } from "@/lib/ai/usage";

const previousLimit = process.env.LICIA_AI_DAILY_TOKEN_LIMIT;

afterEach(() => {
  if (previousLimit === undefined) delete process.env.LICIA_AI_DAILY_TOKEN_LIMIT;
  else process.env.LICIA_AI_DAILY_TOKEN_LIMIT = previousLimit;
});

describe("dailyTokenLimit", () => {
  it("memakai batas aman bawaan jika nilai kosong atau nol", () => {
    delete process.env.LICIA_AI_DAILY_TOKEN_LIMIT;
    expect(dailyTokenLimit()).toBe(20_000);
    process.env.LICIA_AI_DAILY_TOKEN_LIMIT = "0";
    expect(dailyTokenLimit()).toBe(20_000);
  });

  it("menghormati batas positif yang dikonfigurasi", () => {
    process.env.LICIA_AI_DAILY_TOKEN_LIMIT = "12500";
    expect(dailyTokenLimit()).toBe(12_500);
  });
});
