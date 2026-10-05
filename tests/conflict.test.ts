import { describe, it, expect } from "vitest";
import { safeStrategy, findConflictingFields, mergeIfSafe, isClientNewer } from "@/lib/sync/conflict";

describe("safeStrategy", () => {
  it("menolak nilai asing dan kembali ke 'server'", () => {
    expect(safeStrategy("hack")).toBe("server");
    expect(safeStrategy(undefined)).toBe("server");
    expect(safeStrategy("smart")).toBe("smart");
  });
});

describe("findConflictingFields", () => {
  it("mengabaikan field metadata", () => {
    expect(findConflictingFields({ id: 1, title: "a", version: 1 }, { id: 2, title: "a", version: 9 })).toEqual([]);
  });
  it("mendeteksi field yang berbeda", () => {
    expect(findConflictingFields({ title: "a", note: "x" }, { title: "b", note: "x" })).toEqual(["title"]);
  });
  it("field yang tidak dikirim klien bukan konflik", () => {
    expect(findConflictingFields({ title: "a", note: "x" }, { title: "a" })).toEqual([]);
  });
});

describe("mergeIfSafe", () => {
  it("aman bila tidak ada field bentrok", () => {
    const r = mergeIfSafe({ current: { title: "a" }, incoming: { title: "a" } });
    expect(r.safe).toBe(true);
  });
  it("konservatif tanpa daftar field yang berubah di server", () => {
    const r = mergeIfSafe({ current: { title: "a" }, incoming: { title: "b" } });
    expect(r.safe).toBe(false);
    expect(r.fields).toEqual(["title"]);
  });
  it("aman bila server mengubah field lain", () => {
    const r = mergeIfSafe({ current: { title: "a", note: "n" }, incoming: { title: "b" } }, ["note"]);
    expect(r.safe).toBe(true);
  });
  it("tidak aman bila field yang sama diubah di server", () => {
    const r = mergeIfSafe({ current: { title: "a" }, incoming: { title: "b" } }, ["title"]);
    expect(r.safe).toBe(false);
    expect(r.fields).toEqual(["title"]);
  });
});

describe("isClientNewer", () => {
  it("membandingkan timestamp", () => {
    expect(isClientNewer("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(true);
    expect(isClientNewer("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(false);
    expect(isClientNewer(null, "2026-01-02T00:00:00Z")).toBe(false);
    expect(isClientNewer("2026-01-01T00:00:00Z", null)).toBe(true);
  });
});
