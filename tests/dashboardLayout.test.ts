import { describe, it, expect } from "vitest";
import {
  DASHBOARD_WIDGETS,
  isCustomized,
  isWidgetVisible,
  moveWidget,
  normalizeLayout,
  parseLayout,
  resetLayout,
  serializeLayout,
  setTodayOnly,
  toggleWidget,
  widgetOrder,
  DEFAULT_DASHBOARD_LAYOUT,
} from "@/lib/dashboardLayout";

const ids = DASHBOARD_WIDGETS.map((w) => w.id);
const defaultIds = DEFAULT_DASHBOARD_LAYOUT.order;

describe("normalizeLayout", () => {
  it("masukan kosong/buruk → bawaan", () => {
    for (const bad of [null, undefined, 42, "x", [], {}]) {
      const l = normalizeLayout(bad);
      expect(l.order).toEqual(defaultIds);
      expect(l.hidden).toEqual([]);
      expect(l.todayOnly).toBe(false);
    }
  });
  it("membuang ID asing/duplikat dan melengkapi yang hilang", () => {
    const l = normalizeLayout({
      order: ["stats", "stats", "hantu", "overview"],
      hidden: ["hantu", "review", "review"],
    });
    expect(l.order[0]).toBe("now");
    expect(l.order).toContain("overview");
    expect(new Set(l.order).size).toBe(ids.length);
    expect(l.hidden).toEqual(["review"]);
  });
  it("widget baru disisipkan setelah tetangga bawaannya", () => {
    const old = ids.filter((id) => id !== "insights");
    const l = normalizeLayout({ order: old });
    expect(l.order.indexOf("insights")).toBe(l.order.indexOf("body") + 1);
  });
  it("todayOnly hanya true bila persis true", () => {
    expect(normalizeLayout({ todayOnly: "true" }).todayOnly).toBe(false);
    expect(normalizeLayout({ todayOnly: true }).todayOnly).toBe(true);
  });
});

describe("serialisasi", () => {
  it("bolak-balik stabil dan JSON rusak tidak melempar", () => {
    const l = moveWidget(resetLayout(), "stats", -1);
    expect(parseLayout(serializeLayout(l))).toEqual(l);
    expect(parseLayout("{bukan json").order).toEqual(defaultIds);
    expect(parseLayout(null).order).toEqual(defaultIds);
  });
});

describe("operasi tata letak", () => {
  it("moveWidget menukar tetangga dan berhenti di ujung", () => {
    const base = resetLayout();
    expect(moveWidget(base, "now", -1)).toBe(base);
    expect(moveWidget(base, "control", 1)).toBe(base);
    const moved = moveWidget(base, "overview", -1);
    expect(moved.order.slice(0, 2)).toEqual(["overview", "now"]);
    expect(widgetOrder(moved, "overview")).toBe(0);
  });
  it("toggleWidget menyembunyikan lalu menampilkan kembali", () => {
    const hidden = toggleWidget(resetLayout(), "insights");
    expect(isWidgetVisible(hidden, "insights")).toBe(false);
    expect(isWidgetVisible(toggleWidget(hidden, "insights"), "insights")).toBe(true);
  });
  it("mode Hari ini saja hanya menampilkan widget harian tanpa menghapus pilihan sembunyi", () => {
    const l = setTodayOnly(toggleWidget(resetLayout(), "stats"), true);
    expect(isWidgetVisible(l, "overview")).toBe(true);
    expect(isWidgetVisible(l, "stats")).toBe(false); // disembunyikan pengguna
    expect(isWidgetVisible(l, "review")).toBe(false); // bukan widget harian
    expect(isWidgetVisible(setTodayOnly(l, false), "review")).toBe(true);
    expect(setTodayOnly(l, false).hidden).toEqual(["stats"]);
  });
  it("isCustomized mendeteksi perubahan", () => {
    expect(isCustomized(resetLayout())).toBe(false);
    expect(isCustomized(setTodayOnly(resetLayout(), true))).toBe(true);
    expect(isCustomized(moveWidget(resetLayout(), "stats", -1))).toBe(true);
  });
});
