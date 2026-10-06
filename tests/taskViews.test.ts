import { describe, it, expect } from "vitest";
import { bucketWeek, clockInTimezone, dayPatch, inversePatch, isEmptyPatch, isUrgent, quadrantOf, quadrantPatch, statusPatch, stepFocus, taskKeyAction, weekDays, weekStartYmd, type ViewTask } from "@/lib/tasks/views";

const TZ = "Asia/Jakarta";
const NOW = new Date("2026-10-05T03:00:00.000Z"); // Senin 5 Okt 2026, 10:00 WIB
const task = (over: Partial<ViewTask> = {}): ViewTask => ({ id: "t", title: "x", status: "todo", priority: "medium", due_at: null, ...over });
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe("kuadran Eisenhower", () => {
  it("penting + mendesak → do; penting saja → plan; mendesak saja → quick; lainnya → later", () => {
    expect(quadrantOf(task({ priority: "high", due_at: inHours(5) }), NOW)).toBe("do");
    expect(quadrantOf(task({ priority: "high", due_at: inHours(200) }), NOW)).toBe("plan");
    expect(quadrantOf(task({ priority: "high" }), NOW)).toBe("plan");
    expect(quadrantOf(task({ priority: "medium", due_at: inHours(5) }), NOW)).toBe("quick");
    expect(quadrantOf(task({ priority: "low", due_at: inHours(500) }), NOW)).toBe("later");
  });
  it("terlambat dianggap mendesak; selesai tidak pernah mendesak", () => {
    expect(isUrgent(task({ due_at: inHours(-30) }), NOW)).toBe(true);
    expect(isUrgent(task({ due_at: inHours(-30), status: "done" }), NOW)).toBe(false);
  });
  it("batas 48 jam", () => {
    expect(isUrgent(task({ due_at: inHours(48) }), NOW)).toBe(true);
    expect(isUrgent(task({ due_at: inHours(48.5) }), NOW)).toBe(false);
  });
});

describe("quadrantPatch", () => {
  it("ke 'do': prioritas tinggi + tenggat hari ini 17:00 WIB bila belum mendesak", () => {
    const p = quadrantPatch(task({ priority: "low" }), "do", TZ, NOW);
    expect(p.priority).toBe("high");
    expect(p.due_at).toBe("2026-10-05T10:00:00.000Z");
  });
  it("ke 'do' saat sudah lewat 17:00: tenggat besok 09:00", () => {
    const late = new Date("2026-10-05T11:00:00.000Z"); // 18:00 WIB
    expect(quadrantPatch(task(), "do", TZ, late).due_at).toBe("2026-10-06T02:00:00.000Z");
  });
  it("ke 'plan' dari kuadran mendesak: tenggat digeser 3 hari, jam dipertahankan", () => {
    const p = quadrantPatch(task({ priority: "high", due_at: inHours(5) }), "plan", TZ, NOW);
    expect(p.priority).toBeUndefined();
    expect(p.due_at).toBe("2026-10-08T08:00:00.000Z"); // 15:00 WIB tetap 15:00 WIB
  });
  it("ke 'later' menurunkan prioritas tinggi dan menggeser tenggat", () => {
    const p = quadrantPatch(task({ priority: "high", due_at: inHours(5) }), "later", TZ, NOW);
    expect(p.priority).toBe("medium");
    expect(p.due_at).toBeTruthy();
  });
  it("tanpa tenggat ke kuadran tak-mendesak: tidak menambahkan tenggat", () => {
    expect(quadrantPatch(task({ priority: "low" }), "plan", TZ, NOW).due_at).toBeUndefined();
  });
  it("tugas selesai yang dipindah dibuka kembali", () => {
    expect(quadrantPatch(task({ status: "done" }), "later", TZ, NOW).status).toBe("todo");
  });
  it("sudah di kuadran target → patch kosong", () => {
    const t = task({ priority: "high", due_at: inHours(5) });
    expect(isEmptyPatch(quadrantPatch(t, "do", TZ, NOW))).toBe(true);
  });
});

describe("minggu", () => {
  it("awal minggu Senin/Minggu", () => {
    expect(weekStartYmd("2026-10-07", "monday")).toBe("2026-10-05");
    expect(weekStartYmd("2026-10-11", "monday")).toBe("2026-10-05"); // Minggu
    expect(weekStartYmd("2026-10-11", "sunday")).toBe("2026-10-11");
    expect(weekStartYmd("2026-10-05", "monday")).toBe("2026-10-05");
  });
  it("7 hari berurutan melewati pergantian bulan", () => {
    expect(weekDays("2026-10-28")).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
  });
  it("jam lokal dihitung pada zona waktu yang diminta", () => {
    expect(clockInTimezone("2026-10-05T10:00:00.000Z", "Asia/Jakarta")).toBe("17:00");
    expect(clockInTimezone("2026-10-05T10:00:00.000Z", "Asia/Jayapura")).toBe("19:00");
  });
  it("dayPatch mempertahankan jam; tanpa tenggat → 09:00", () => {
    expect(dayPatch(task({ due_at: "2026-10-05T10:00:00.000Z" }), "2026-10-08", TZ).due_at).toBe("2026-10-08T10:00:00.000Z");
    expect(dayPatch(task(), "2026-10-08", TZ).due_at).toBe("2026-10-08T02:00:00.000Z");
  });
  it("bucketWeek memisahkan hari, tanpa tenggat, dan di luar pekan", () => {
    const ts = [
      task({ id: "a", due_at: "2026-10-05T10:00:00.000Z" }),
      task({ id: "b", due_at: "2026-10-05T02:00:00.000Z" }),
      task({ id: "c", due_at: "2026-10-09T02:00:00.000Z" }),
      task({ id: "d" }),
      task({ id: "e", status: "done" }),
      task({ id: "f", due_at: "2026-11-20T02:00:00.000Z" }),
    ];
    const b = bucketWeek(ts, "2026-10-05", TZ);
    expect(b.days[0].tasks.map((x) => x.id)).toEqual(["b", "a"]);
    expect(b.days[4].tasks.map((x) => x.id)).toEqual(["c"]);
    expect(b.unscheduled.map((x) => x.id)).toEqual(["d"]);
    expect(b.outside.map((x) => x.id)).toEqual(["f"]);
  });
});

describe("Kanban & Urungkan", () => {
  it("statusPatch null bila status sama", () => {
    expect(statusPatch(task(), "todo")).toBeNull();
    expect(statusPatch(task(), "done")).toEqual({ status: "done" });
  });
  it("inversePatch mengembalikan nilai sebelumnya", () => {
    const t = task({ priority: "low", due_at: "2026-10-05T10:00:00.000Z" });
    expect(inversePatch(t, { priority: "high", due_at: null })).toEqual({ priority: "low", due_at: "2026-10-05T10:00:00.000Z" });
  });
});

describe("pintasan daftar tugas (A12)", () => {
  it("memetakan j/k/x/e/Enter", () => {
    expect(taskKeyAction("j")).toBe("next");
    expect(taskKeyAction("k")).toBe("prev");
    expect(taskKeyAction("x")).toBe("toggle");
    expect(taskKeyAction("e")).toBe("edit");
    expect(taskKeyAction("Enter")).toBe("open");
    expect(taskKeyAction("z")).toBeNull();
  });
  it("abaikan bila Ctrl/⌘/Alt ditekan", () => {
    expect(taskKeyAction("x", { ctrl: true })).toBeNull();
    expect(taskKeyAction("j", { meta: true })).toBeNull();
  });
  it("stepFocus berhenti di ujung dan menangani daftar kosong", () => {
    expect(stepFocus(-1, "next", 3)).toBe(0);
    expect(stepFocus(-1, "prev", 3)).toBe(2);
    expect(stepFocus(2, "next", 3)).toBe(2);
    expect(stepFocus(0, "prev", 3)).toBe(0);
    expect(stepFocus(1, "last", 3)).toBe(2);
    expect(stepFocus(0, "next", 0)).toBe(-1);
  });
});
