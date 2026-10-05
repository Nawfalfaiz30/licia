import { describe, expect, it } from "vitest";
import { nextIndex } from "@/lib/listNav";

describe("nextIndex", () => {
  it("mulai dari awal/akhir bila belum ada fokus", () => { expect(nextIndex(-1, 5, "next")).toBe(0); expect(nextIndex(-1, 5, "prev")).toBe(4); });
  it("bergerak satu langkah dan berhenti di ujung", () => { expect(nextIndex(1, 5, "next")).toBe(2); expect(nextIndex(4, 5, "next")).toBe(4); expect(nextIndex(0, 5, "prev")).toBe(0); });
  it("first/last dan daftar kosong", () => { expect(nextIndex(2, 5, "first")).toBe(0); expect(nextIndex(2, 5, "last")).toBe(4); expect(nextIndex(0, 0, "next")).toBe(-1); });
});
