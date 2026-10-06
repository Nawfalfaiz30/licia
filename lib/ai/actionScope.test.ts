import { describe, expect, it } from "vitest";
import { resolveActionScope } from "@/lib/ai/actionScope";

describe("resolveActionScope", () => {
  const now = new Date("2026-10-06T10:00:00.000Z");

  it("resolves hari ini to one local day", () => {
    const scope = resolveActionScope("tandai tugas hari ini selesai", now, "Asia/Jakarta");
    expect(scope.kind).toBe("day");
    expect(scope.fromDate).toBe("2026-10-06");
    expect(scope.toDate).toBe("2026-10-06");
    expect(scope.explicit).toBe(true);
  });

  it("resolves besok dan seterusnya to after-today", () => {
    const scope = resolveActionScope("kembalikan tugas besok dan seterusnya", now, "Asia/Jakarta");
    expect(scope.kind).toBe("after");
    expect(scope.fromDate).toBe("2026-10-06");
    expect(scope.toDate).toBe("2026-10-06");
  });

  it("resolves minggu ini to monday-sunday", () => {
    const scope = resolveActionScope("review tugas minggu ini", now, "Asia/Jakarta");
    expect(scope.kind).toBe("range");
    expect(scope.fromDate).toBe("2026-10-05");
    expect(scope.toDate).toBe("2026-10-11");
  });

  it("resolves before today to yesterday end", () => {
    const scope = resolveActionScope("kembalikan tugas sebelum hari ini", now, "Asia/Jakarta");
    expect(scope.kind).toBe("before");
    expect(scope.fromDate).toBe("2026-10-05");
    expect(scope.toDate).toBe("2026-10-05");
  });
});