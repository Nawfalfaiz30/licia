import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AA_NORMAL, DARK_SURFACES, LIGHT_SURFACES, blend, contrastRatio, deriveAccentTokens, deriveRoleTokens, hexToRgb, rgbToHex } from "@/lib/contrast";
import { accentPresets, bgPresetsDark, bgPresetsLight } from "@/lib/theme";

const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const triple = (name: string, block: "root" | "dark"): string => {
  const start = block === "root" ? css.indexOf(":root {") : css.indexOf(".dark {");
  const body = css.slice(start, css.indexOf("}", start));
  const m = new RegExp(`${name}:\\s*(?:var\\([^,]+,\\s*)?(\\d+ \\d+ \\d+)`).exec(body);
  if (!m) throw new Error(`token ${name} tidak ditemukan`);
  const [r, g, b] = m[1].split(" ").map(Number);
  return rgbToHex([r, g, b]);
};

const hexVar = (name: string, block: "root" | "dark"): string => {
  const start = block === "root" ? css.indexOf(":root {") : css.indexOf(".dark {");
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css.slice(start, css.indexOf("}", start)));
  if (!m) throw new Error(`token ${name} tidak ditemukan`);
  return m[1];
};

describe("util kontras", () => {
  it("rasio hitam/putih = 21 dan simetris", () => {
    expect(Math.round(contrastRatio("#000000", "#ffffff"))).toBe(21);
    expect(contrastRatio("#3d5fd9", "#ffffff")).toBe(contrastRatio("#ffffff", "#3d5fd9"));
  });
  it("hex tak valid tidak melempar", () => {
    expect(hexToRgb("zzz")).toBeNull();
    expect(contrastRatio("zzz", "#fff")).toBe(1);
  });
  it("blend 0 = latar, 1 = depan", () => {
    expect(blend("#000000", "#ffffff", 0)).toBe("#ffffff");
    expect(blend("#000000", "#ffffff", 1)).toBe("#000000");
  });
});

describe("token aksen turunan (A10)", () => {
  const hexes = [...accentPresets.map((p) => p.hex), "#5b7dfa", "#ff00aa", "#ffee00", "#00ffcc", "#808080"];
  for (const hex of hexes) {
    it(`aksen ${hex} lolos AA di kedua mode`, () => {
      const t = deriveAccentTokens(hex);
      expect(contrastRatio(t.lightFill, "#ffffff")).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(t.darkFill, "#ffffff")).toBeGreaterThanOrEqual(AA_NORMAL);
      for (const s of LIGHT_SURFACES) {
        expect(contrastRatio(t.lightInk, s)).toBeGreaterThanOrEqual(AA_NORMAL);
        expect(contrastRatio(t.lightInk, blend(t.lightInk, s, 0.12))).toBeGreaterThanOrEqual(AA_NORMAL);
      }
      for (const s of DARK_SURFACES) {
        expect(contrastRatio(t.darkInk, s)).toBeGreaterThanOrEqual(AA_NORMAL);
        expect(contrastRatio(t.darkInk, blend(t.darkInk, s, 0.12))).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });
  }
  it("warna yang sudah aman tidak diubah tanpa perlu", () => {
    expect(deriveRoleTokens("#3d5fd9", "light").fill).toBe("#3d5fd9");
  });
});

describe("token bawaan di globals.css", () => {
  it("isian aksen/bahaya/sukses terbaca dengan teks putih di kedua mode", () => {
    for (const [name, block] of [["--accent-rgb", "root"], ["--accent-rgb", "dark"], ["--danger-rgb", "root"], ["--success-rgb", "root"], ["--success-rgb", "dark"]] as const) {
      expect(contrastRatio(triple(name, block), "#ffffff")).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });
  it("tinta aksen/bahaya/sukses terbaca di atas semua latar preset", () => {
    for (const name of ["--accent-ink-rgb", "--danger-ink-rgb", "--success-ink-rgb"]) {
      const ink = triple(name, "root");
      for (const s of ["#ffffff", ...bgPresetsLight.map((b) => b.hex)]) expect(contrastRatio(ink, s)).toBeGreaterThanOrEqual(AA_NORMAL);
    }
    for (const name of ["--accent-ink-rgb", "--danger-ink-rgb", "--success-ink-rgb"]) {
      const ink = triple(name, "dark");
      for (const s of [...bgPresetsDark.map((b) => b.hex), "#171b2e", "#1d2238"]) expect(contrastRatio(ink, s)).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });
  it("teks redup terbaca di semua latar preset", () => {
    for (const s of ["#ffffff", ...bgPresetsLight.map((b) => b.hex)]) expect(contrastRatio(hexVar("--text-muted", "root"), s)).toBeGreaterThanOrEqual(AA_NORMAL);
    for (const s of [...bgPresetsDark.map((b) => b.hex), "#171b2e"]) expect(contrastRatio(hexVar("--text-muted", "dark"), s)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
