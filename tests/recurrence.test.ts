import { describe, it, expect } from "vitest";
import { nextOccurrence, parseRecurrence, describeRule, buildNextTask, normalizeRule } from "@/lib/tasks/recurrence";

// 7 Okt 2026 19:00 WIB = 12:00Z (Rabu)
const WED = "2026-10-07T12:00:00.000Z";

describe("nextOccurrence", () => {
  it("harian dan jam dinding WIB tidak bergeser tanggal", () => {
    expect(nextOccurrence({ freq: "daily", interval: 1 }, WED)).toBe("2026-10-08T12:00:00.000Z");
    expect(nextOccurrence({ freq: "daily", interval: 1 }, "2026-10-07T16:30:00.000Z")).toBe("2026-10-08T16:30:00.000Z");
  });
  it("hari kerja melompati akhir pekan", () => {
    expect(nextOccurrence({ freq: "weekdays", interval: 1 }, "2026-10-09T12:00:00.000Z")).toBe("2026-10-12T12:00:00.000Z");
  });
  it("mingguan dengan beberapa hari", () => {
    const rule = { freq: "weekly", interval: 1, byWeekday: [1, 4] };
    expect(nextOccurrence(rule, WED)).toBe("2026-10-08T12:00:00.000Z");
    expect(nextOccurrence(rule, "2026-10-08T12:00:00.000Z")).toBe("2026-10-12T12:00:00.000Z");
  });
  it("bulanan memakai tanggal jangkar (tidak melorot)", () => {
    const rule = { freq: "monthly", interval: 1, anchorDay: 31 };
    expect(nextOccurrence(rule, "2026-01-31T02:00:00.000Z")).toBe("2026-02-28T02:00:00.000Z");
    expect(nextOccurrence(rule, "2026-02-28T02:00:00.000Z")).toBe("2026-03-31T02:00:00.000Z");
  });
  it("menghormati batas until", () => {
    expect(nextOccurrence({ freq: "daily", interval: 1, until: "2026-10-07" }, WED)).toBeNull();
  });
  it("penyelesaian terlambat melompat ke masa depan", () => {
    expect(nextOccurrence({ freq: "daily", interval: 1 }, "2026-09-01T02:00:00.000Z", { after: new Date("2026-10-04T10:00:00Z") })).toBe("2026-10-05T02:00:00.000Z");
  });
  it("masukan tak valid → null", () => {
    expect(nextOccurrence({ freq: "hourly" }, WED)).toBeNull();
    expect(nextOccurrence({ freq: "daily", interval: 1 }, "bukan-tanggal")).toBeNull();
  });
});

describe("normalizeRule & buildNextTask", () => {
  it("menormalkan interval dan membuang nilai aneh", () => {
    expect(normalizeRule({ freq: "daily", interval: -5 })).toEqual({ freq: "daily", interval: 1 });
    expect(normalizeRule({ freq: "weekly", interval: 2, byWeekday: [9, 1, 1, "x"] })).toEqual({ freq: "weekly", interval: 2, byWeekday: [1] });
    expect(normalizeRule(null)).toBeNull();
  });
  it("membuat tugas berikutnya setelah sekarang", () => {
    expect(buildNextTask({ due_at: "2026-10-01T02:00:00Z", recurrence: { freq: "weekly", interval: 1 } }, new Date("2026-10-04T10:00:00Z"))).toEqual({ due_at: "2026-10-08T02:00:00.000Z" });
    expect(buildNextTask({ due_at: null, recurrence: null })).toBeNull();
  });
});

describe("parseRecurrence", () => {
  it("mengenali frasa Indonesia dan English", () => {
    expect(parseRecurrence("kirim laporan setiap senin dan kamis")).toMatchObject({ rule: { freq: "weekly", byWeekday: [1, 4] }, cleaned: "kirim laporan" });
    expect(parseRecurrence("olahraga tiap hari")?.rule.freq).toBe("daily");
    expect(parseRecurrence("bayar listrik every 2 weeks")?.rule).toMatchObject({ freq: "weekly", interval: 2 });
    expect(parseRecurrence("rapat hari kerja jam 9")).toMatchObject({ rule: { freq: "weekdays" }, cleaned: "rapat jam 9" });
    expect(parseRecurrence("review every friday")?.rule.byWeekday).toEqual([5]);
  });
  it("konservatif: 'minggu depan' bukan pengulangan", () => {
    expect(parseRecurrence("cek minggu depan")).toBeNull();
    expect(parseRecurrence("beli susu")).toBeNull();
  });
});

describe("describeRule", () => {
  it("dwibahasa", () => {
    expect(describeRule({ freq: "weekly", interval: 1, byWeekday: [1, 4] }, "en")).toBe("Every week (Monday, Thursday)");
    expect(describeRule({ freq: "daily", interval: 3 }, "id")).toBe("Setiap 3 hari");
    expect(describeRule(null, "en")).toBe("Does not repeat");
  });
});
