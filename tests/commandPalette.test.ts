import { describe, it, expect } from "vitest";
import { composePalette, filterPalette, moveActive, parsePaletteQuery, type PaletteItem } from "@/lib/commandPalette";

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

const page = (id: string, label: string, keywords = ""): PaletteItem => ({ id: `page:${id}`, kind: "page", label, keywords, href: `/${id}`, group: "Halaman" });
const cmd = (id: string, label: string, keywords = ""): PaletteItem => ({ id: `cmd:${id}`, kind: "command", commandId: id, label, keywords, group: "Aksi" });
const create: PaletteItem = { id: "create-task", kind: "create-task", label: "Buat tugas", payload: "x", group: "Buat" };
const pages = [page("tasks", "Tugas", "tasks todo"), page("finance", "Keuangan", "finance money"), page("settings", "Pengaturan", "settings")];
const commands = [cmd("new-task", "Buat tugas baru", "new task create"), cmd("theme-dark", "Tema gelap", "theme dark"), cmd("language-toggle", "Ganti bahasa", "language english")];
const results: PaletteItem[] = [{ id: "res:1", kind: "result", label: "Catatan rapat", href: "/notes", group: "Hasil" }];

describe("parsePaletteQuery", () => {
  it("awalan > / ? menentukan cakupan", () => {
    expect(parsePaletteQuery(">tema")).toEqual({ scope: "commands", text: "tema" });
    expect(parsePaletteQuery("  / keu")).toEqual({ scope: "pages", text: "keu" });
    expect(parsePaletteQuery("?rapat")).toEqual({ scope: "data", text: "rapat" });
    expect(parsePaletteQuery("kirim laporan")).toEqual({ scope: "all", text: "kirim laporan" });
  });
});

describe("composePalette", () => {
  const run = (query: string, createTask: PaletteItem | null = create) => composePalette({ query, pages, commands, results, createTask }).items.map((i) => i.id);
  it("kueri kosong → perintah teratas lalu halaman", () => {
    const ids = run("");
    expect(ids[0]).toBe("cmd:new-task");
    expect(ids).toContain("page:finance");
    expect(ids).not.toContain("create-task");
  });
  it("kueri '>' hanya perintah; '/' hanya halaman; '?' hanya data", () => {
    expect(run(">tema")).toEqual(["cmd:theme-dark"]);
    expect(run("/keu")).toEqual(["page:finance"]);
    expect(run("?rapat")).toEqual(["res:1"]);
  });
  it("kata kunci Inggris menemukan perintah/halaman berlabel Indonesia", () => {
    expect(run(">english")).toEqual(["cmd:language-toggle"]);
    expect(run("/money")).toEqual(["page:finance"]);
  });
  it("teks bebas tanpa kecocokan → 'Buat tugas' paling atas", () => {
    expect(run("kirim laporan besok")[0]).toBe("create-task");
  });
  it("ada halaman cocok → navigasi didahulukan, 'Buat tugas' menyusul", () => {
    const ids = run("tugas");
    expect(ids[0]).toBe("page:tasks");
    expect(ids.indexOf("create-task")).toBeGreaterThan(ids.indexOf("page:tasks"));
  });
  it("tanpa createTask (teks terlalu pendek) tidak ada entri buat", () => {
    expect(run("xy", null)).not.toContain("create-task");
  });
  it("cakupan non-'all' tidak pernah menampilkan 'Buat tugas'", () => {
    expect(run(">zzz")).toEqual([]);
  });
});
