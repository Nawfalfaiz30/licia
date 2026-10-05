import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, WIDGET_IDS, moveWidget, normalizePrefs, parsePrefs, serializePrefs, toggleWidget, visibleWidgets } from "@/lib/dashboard/layout";

describe("tata letak dashboard", () => {
  it("default menampilkan semua widget sesuai urutan awal", () => { expect(visibleWidgets(DEFAULT_PREFS)).toEqual([...WIDGET_IDS]); });
  it("membersihkan data rusak: id asing dibuang, id baru ditambahkan, header tetap pertama", () => {
    const p = normalizePrefs({ order: ["review", "x", "header", "review", "stats"], hidden: ["header", "nope", "life"] });
    expect(p.order[0]).toBe("header");
    expect(p.order.slice(1, 3)).toEqual(["review", "stats"]);
    expect([...p.order].sort()).toEqual([...WIDGET_IDS].sort());
    expect(p.hidden).toEqual(["life"]);
  });
  it("cookie rusak jatuh ke default", () => { expect(parsePrefs("%%%")).toEqual(DEFAULT_PREFS); expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS); });
  it("bolak-balik serialisasi", () => {
    const p = toggleWidget(moveWidget(DEFAULT_PREFS, "review", -1), "insights");
    expect(parsePrefs(serializePrefs(p))).toEqual(p);
  });
  it("sembunyikan dan pindahkan; header tidak bisa", () => {
    expect(visibleWidgets(toggleWidget(DEFAULT_PREFS, "insights"))).not.toContain("insights");
    expect(toggleWidget(DEFAULT_PREFS, "header")).toEqual(DEFAULT_PREFS);
    expect(moveWidget(DEFAULT_PREFS, "header", 1)).toEqual(DEFAULT_PREFS);
    const moved = moveWidget(DEFAULT_PREFS, "next", -1);
    expect(moved.order.indexOf("next")).toBe(DEFAULT_PREFS.order.indexOf("next") - 1);
    expect(moved.order[0]).toBe("header");
  });
  it("tidak bisa melewati ujung", () => {
    const last = DEFAULT_PREFS.order[DEFAULT_PREFS.order.length - 1];
    expect(moveWidget(DEFAULT_PREFS, last, 1)).toEqual(DEFAULT_PREFS);
    expect(moveWidget(DEFAULT_PREFS, "onboarding", -1)).toEqual(DEFAULT_PREFS);
  });
  it("mode Hari ini saja memfilter dan mengabaikan hidden", () => {
    const v = visibleWidgets({ ...DEFAULT_PREFS, todayOnly: true });
    expect(v).toEqual(["header", "onboarding", "next", "stats", "today"]);
  });
});
