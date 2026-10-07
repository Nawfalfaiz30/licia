import { describe, it, expect, beforeEach } from "vitest";
import { resolveTabTarget } from "@/lib/focusTrap";
import { __resetOverlayState, isTopOverlay, overlayDepth, pushOverlay, removeOverlay } from "@/lib/overlayStack";
import { Z, zOrder } from "@/lib/zIndex";
import { UndoQueue } from "@/lib/undo";

describe("resolveTabTarget (perangkap fokus)", () => {
  it("Tab di elemen terakhir kembali ke pertama; Shift+Tab di pertama ke terakhir", () => {
    expect(resolveTabTarget(2, 3, false)).toBe(0);
    expect(resolveTabTarget(0, 3, true)).toBe(2);
  });
  it("di tengah daftar biarkan browser bekerja", () => {
    expect(resolveTabTarget(1, 3, false)).toBeNull();
    expect(resolveTabTarget(1, 3, true)).toBeNull();
  });
  it("fokus di luar daftar (panel/latar) ditarik masuk", () => {
    expect(resolveTabTarget(-1, 4, false)).toBe(0);
    expect(resolveTabTarget(-1, 4, true)).toBe(3);
  });
  it("tanpa elemen fokus: tahan di panel", () => {
    expect(resolveTabTarget(-1, 0, false)).toBe(-1);
  });
  it("satu elemen: Tab dan Shift+Tab tetap di elemen itu", () => {
    expect(resolveTabTarget(0, 1, false)).toBe(0);
    expect(resolveTabTarget(0, 1, true)).toBe(0);
  });
});

describe("tumpukan overlay", () => {
  beforeEach(() => __resetOverlayState());
  it("hanya yang teratas yang aktif; menutup yang atas mengaktifkan yang bawah", () => {
    pushOverlay("a");
    pushOverlay("b");
    expect(isTopOverlay("b")).toBe(true);
    expect(isTopOverlay("a")).toBe(false);
    removeOverlay("b");
    expect(isTopOverlay("a")).toBe(true);
  });
  it("push ganda tidak menduplikasi", () => {
    pushOverlay("a");
    pushOverlay("a");
    expect(overlayDepth()).toBe(1);
  });
  it("tumpukan kosong → tak ada yang teratas", () => {
    expect(isTopOverlay("x")).toBe(false);
  });
});

describe("skala z-index", () => {
  it("urutan hirarki: nav < header < float < banner < popover < sheet < modal < palette < toast < skip", () => {
    expect(zOrder()).toEqual([
      "nav",
      "header",
      "float",
      "banner",
      "popover",
      "sheet",
      "modal",
      "palette",
      "toast",
      "skip",
    ]);
  });
  it("dialog konfirmasi (modal) berada di atas sheet; toast di atas semuanya kecuali skip-link", () => {
    expect(Z.modal).toBeGreaterThan(Z.sheet);
    expect(Z.toast).toBeGreaterThan(Z.palette);
  });
});

describe("UndoQueue", () => {
  const fake = () => {
    const jobs: Array<{ fn: () => void; ms: number; id: number; live: boolean }> = [];
    return {
      timers: {
        set: (fn: () => void, ms: number) => {
          const j = { fn, ms, id: jobs.length, live: true };
          jobs.push(j);
          return j;
        },
        clear: (h: unknown) => {
          (h as { live: boolean }).live = false;
        },
      },
      fire: () =>
        jobs
          .filter((j) => j.live)
          .forEach((j) => {
            j.live = false;
            j.fn();
          }),
    };
  };
  it("komit berjalan setelah jeda bila tidak dibatalkan", async () => {
    const f = fake();
    const q = new UndoQueue(f.timers);
    let n = 0;
    q.schedule(
      "t1",
      () => {
        n += 1;
      },
      5000,
    );
    expect(q.has("t1")).toBe(true);
    f.fire();
    await Promise.resolve();
    expect(n).toBe(1);
    expect(q.has("t1")).toBe(false);
  });
  it("cancel mencegah komit", async () => {
    const f = fake();
    const q = new UndoQueue(f.timers);
    let n = 0;
    q.schedule(
      "t1",
      () => {
        n += 1;
      },
      5000,
    );
    expect(q.cancel("t1")).toBe(true);
    f.fire();
    await Promise.resolve();
    expect(n).toBe(0);
    expect(q.cancel("t1")).toBe(false);
  });
  it("flushAll menjalankan semua komit tertunda (mis. tab ditutup)", async () => {
    const f = fake();
    const q = new UndoQueue(f.timers);
    const done: string[] = [];
    q.schedule(
      "a",
      () => {
        done.push("a");
      },
      5000,
    );
    q.schedule(
      "b",
      () => {
        done.push("b");
      },
      5000,
    );
    await q.flushAll();
    expect(done).toEqual(["a", "b"]);
    expect(q.size).toBe(0);
  });
  it("menjadwalkan id yang sama menjalankan komit lama lebih dulu", async () => {
    const f = fake();
    const q = new UndoQueue(f.timers);
    const done: string[] = [];
    q.schedule(
      "a",
      () => {
        done.push("lama");
      },
      5000,
    );
    q.schedule(
      "a",
      () => {
        done.push("baru");
      },
      5000,
    );
    await Promise.resolve();
    expect(done).toEqual(["lama"]);
    await q.flushAll();
    expect(done).toEqual(["lama", "baru"]);
  });
});
