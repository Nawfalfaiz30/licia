import { describe, expect, it } from "vitest";
import { dueDayOf, isUrgent, quadrantOf, quadrantPatch, weekDays, weekPatch, type ViewTask } from "@/lib/tasks/views";

const tz = "Asia/Jakarta";
const now = new Date("2026-10-05T03:00:00Z"); // 10:00 WIB
const task = (over: Partial<ViewTask> = {}): ViewTask => ({ id: "t", status: "todo", priority: "medium", due_at: null, ...over });

describe("matriks Eisenhower", () => {
  it("mengelompokkan berdasarkan prioritas tinggi dan tenggat 48 jam", () => {
    expect(quadrantOf(task({ priority: "high", due_at: "2026-10-05T10:00:00Z" }), now)).toBe("doFirst");
    expect(quadrantOf(task({ priority: "high" }), now)).toBe("schedule");
    expect(quadrantOf(task({ due_at: "2026-10-04T01:00:00Z" }), now)).toBe("quick");
    expect(quadrantOf(task({ due_at: "2026-10-20T01:00:00Z" }), now)).toBe("later");
  });
  it("tugas terlambat dianggap mendesak; tanpa tenggat tidak", () => {
    expect(isUrgent({ due_at: "2026-09-01T00:00:00Z" }, now)).toBe(true);
    expect(isUrgent({ due_at: null }, now)).toBe(false);
  });
  it("patch memindahkan ke kuadran tujuan dan hasilnya konsisten", () => {
    for (const from of [task(), task({ priority: "high" }), task({ due_at: "2026-10-06T02:00:00Z" }), task({ priority: "high", due_at: "2026-10-06T02:00:00Z" })]) {
      for (const target of ["doFirst", "schedule", "quick", "later"] as const) {
        const p = quadrantPatch(from, target, tz, now);
        const after = { ...from, ...p } as ViewTask;
        expect(quadrantOf(after, now)).toBe(target);
      }
    }
  });
  it("tidak mengubah apa pun bila sudah di kuadran tujuan", () => {
    const t = task({ priority: "high", due_at: "2026-10-05T10:00:00Z" });
    expect(quadrantPatch(t, "doFirst", tz, now)).toEqual({});
  });
});

describe("tampilan minggu", () => {
  it("menghasilkan 7 hari berurutan mulai hari ini (zona pengguna)", () => {
    const days = weekDays(now, tz);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ day: "2026-10-05", isToday: true });
    expect(days[6].day).toBe("2026-10-11");
  });
  it("memindahkan hari dengan mempertahankan jam, dan null menghapus tanggal", () => {
    const t = { due_at: "2026-10-05T07:30:00Z" }; // 14:30 WIB
    const patch = weekPatch(t, "2026-10-08", tz);
    expect(patch.due_at).toBe("2026-10-08T07:30:00.000Z");
    expect(dueDayOf({ due_at: patch.due_at }, tz)).toBe("2026-10-08");
    expect(weekPatch(t, null, tz)).toEqual({ due_at: null });
  });
});
