import { describe, it, expect } from "vitest";
import { GO_TO, GO_TO_I18N, buildShortcutHelp, resolveTaskListKey, stepIndex } from "@/lib/shortcuts";
import { t } from "@/lib/i18n";

describe("pintasan daftar tugas", () => {
  it("memetakan tombol ke aksi", () => {
    expect(resolveTaskListKey("j")).toBe("next");
    expect(resolveTaskListKey("ArrowUp")).toBe("prev");
    expect(resolveTaskListKey("x")).toBe("toggle");
    expect(resolveTaskListKey("e")).toBe("edit");
    expect(resolveTaskListKey("Enter")).toBe("open");
    expect(resolveTaskListKey("z")).toBeNull();
  });
  it("stepIndex tanpa wrap", () => {
    expect(stepIndex(-1, "next", 3)).toBe(0);
    expect(stepIndex(2, "next", 3)).toBe(2);
    expect(stepIndex(-1, "prev", 3)).toBe(2);
    expect(stepIndex(0, "prev", 3)).toBe(0);
    expect(stepIndex(0, "next", 0)).toBe(-1);
  });
});

describe("bantuan pintasan dwibahasa", () => {
  it("setiap huruf 'g' punya kunci terjemahan yang valid di kedua bahasa", () => {
    for (const key of Object.keys(GO_TO)) {
      const i18n = GO_TO_I18N[key];
      expect(Boolean(i18n)).toBe(true);
      expect(t(i18n, "id") === i18n).toBe(false);
      expect(t(i18n, "en") === i18n).toBe(false);
    }
  });
  it("jumlah butir sama di kedua bahasa dan judul diterjemahkan", () => {
    const id = buildShortcutHelp((k, p) => t(k, "id", p));
    const en = buildShortcutHelp((k, p) => t(k, "en", p));
    expect(en.map((g) => g.items.length)).toEqual(id.map((g) => g.items.length));
    expect(id[0].title).toBe("Umum");
    expect(en[0].title).toBe("General");
    expect(id[1].items).toHaveLength(Object.keys(GO_TO).length);
  });
});
