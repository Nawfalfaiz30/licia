import { describe, it, expect } from "vitest";
import { filterPalette, moveActive } from "@/lib/commandPalette";

const E = [
  { label: "Beranda", href: "/dashboard" },
  { label: "Tugas", href: "/tasks" },
  { label: "Target & Proyek", href: "/goals-projects" },
  { label: "Knowledge & Belajar", href: "/knowledge" },
  { label: "Pengaturan", href: "/settings" },
  { label: "Pencarian", href: "/search" },
];

describe("filterPalette", () => {
  it("kueri kosong → semua, urutan asli", () => {
    expect(filterPalette(E, "").map((e) => e.href)).toEqual(E.map((e) => e.href));
    expect(filterPalette(E, "   ").length).toBe(E.length);
  });
  it("awalan label diutamakan di atas kecocokan di tengah", () => {
    expect(filterPalette(E, "pe").map((e) => e.label)).toEqual(["Pengaturan", "Pencarian"]);
  });
  it("kata kedua pada label cocok (setelah &)", () => {
    expect(filterPalette(E, "proy")[0].label).toBe("Target & Proyek");
    expect(filterPalette(E, "belajar")[0].label).toBe("Knowledge & Belajar");
  });
  it("cocok lewat alamat; tidak peka huruf besar", () => {
    expect(filterPalette(E, "/SETT")[0].href).toBe("/settings");
  });
  it("tidak ada yang cocok → kosong", () => {
    expect(filterPalette(E, "zzz")).toEqual([]);
  });
  it("tidak mengubah array masukan", () => {
    const copy = JSON.stringify(E);
    filterPalette(E, "t");
    expect(JSON.stringify(E)).toBe(copy);
  });
});

describe("moveActive", () => {
  it("bawah/atas dengan wrap-around", () => {
    expect(moveActive(0, 1, 3)).toBe(1);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
  });
  it("dari belum ada sorotan: bawah → 0, atas → terakhir", () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
  });
  it("first/last dan daftar kosong", () => {
    expect(moveActive(1, "first", 4)).toBe(0);
    expect(moveActive(1, "last", 4)).toBe(3);
    expect(moveActive(0, 1, 0)).toBe(-1);
  });
  it("indeks kedaluwarsa (daftar menyusut) aman", () => {
    expect(moveActive(9, 1, 3)).toBe(0);
  });
});

import { createActionsFor, filterCommands, parsePaletteQuery, SYSTEM_COMMANDS } from "@/lib/commandPalette";

describe("palet perintah v0.57 (aksi)", () => {
  it("mengenali awalan", () => {
    expect(parsePaletteQuery("t kirim laporan besok")).toEqual({ mode: "task", text: "kirim laporan besok" });
    expect(parsePaletteQuery("+ beli kopi")).toEqual({ mode: "task", text: "beli kopi" });
    expect(parsePaletteQuery("i ide aplikasi")).toEqual({ mode: "inbox", text: "ide aplikasi" });
    expect(parsePaletteQuery("$ makan siang 25rb")).toEqual({ mode: "expense", text: "makan siang 25rb" });
    expect(parsePaletteQuery("> gelap")).toEqual({ mode: "commands", text: "gelap" });
    expect(parsePaletteQuery(">gelap")).toEqual({ mode: "commands", text: "gelap" });
  });
  it("kata biasa yang kebetulan berawal huruf awalan tidak dianggap awalan", () => {
    expect(parsePaletteQuery("tugas")).toEqual({ mode: "all", text: "tugas" });
    expect(parsePaletteQuery("inbox")).toEqual({ mode: "all", text: "inbox" });
    expect(parsePaletteQuery("e")).toEqual({ mode: "all", text: "e" });
  });
  it("menawarkan aksi pembuatan sesuai mode dan nominal", () => {
    expect(createActionsFor({ mode: "all", text: "beli kopi" }, false)).toEqual(["create-task", "create-inbox"]);
    expect(createActionsFor({ mode: "all", text: "kopi 25rb" }, true)).toEqual(["create-task", "create-inbox", "create-expense"]);
    expect(createActionsFor({ mode: "expense", text: "kopi" }, false)).toEqual([]);
    expect(createActionsFor({ mode: "commands", text: "gelap" }, false)).toEqual([]);
    expect(createActionsFor({ mode: "all", text: "a" }, false)).toEqual([]);
  });
  it("menyaring perintah di dua bahasa", () => {
    expect(filterCommands(SYSTEM_COMMANDS, "dark").map((c) => c.id)).toContain("theme-dark");
    expect(filterCommands(SYSTEM_COMMANDS, "gelap").map((c) => c.id)).toContain("theme-dark");
    expect(filterCommands(SYSTEM_COMMANDS, "language").map((c) => c.id)).toEqual(["lang-id", "lang-en"]);
  });
});
