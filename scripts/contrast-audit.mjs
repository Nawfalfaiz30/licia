#!/usr/bin/env node
/**
 * Audit kontras WCAG AA untuk SEMUA kombinasi tema (A10): setiap preset aksen × setiap preset latar × mode.
 *   - teks aksen (text-accent) terhadap latar & permukaan  ≥ 4.5
 *   - teks di atas tombol aksen (bg-accent)                ≥ 4.5
 *   - text-muted / text terhadap latar & permukaan          ≥ 4.5
 * Aksen dihitung lewat algoritma runtime yang sama (lib/a11y/contrast.ts). Gagal → exit 1 (dipakai CI).
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const out = ts.transpileModule(fs.readFileSync("lib/a11y/contrast.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", out)(mod, mod.exports, createRequire(import.meta.url));
const { parseHex, contrastRatio, accessibleAccent } = mod.exports;

const theme = fs.readFileSync("lib/theme.ts", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const hexes = (name) =>
  [
    ...(theme.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`))?.[1] ?? "").matchAll(
      /hex:\s*"(#[0-9a-fA-F]{6})"/g,
    ),
  ].map((m) => m[1]);
const constant = (name) => theme.match(new RegExp(`${name}\\s*=\\s*"(#[0-9a-fA-F]{6})"`))?.[1];
const block = (sel) => css.match(new RegExp(`${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
const v = (blk, name) => blk.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

const modes = {
  light: {
    bgs: [...hexes("bgPresetsLight"), constant("BG_DEFAULT_LIGHT")].filter(Boolean),
    surface: v(block(":root"), "surface"),
    text: v(block(":root"), "text"),
    muted: v(block(":root"), "text-muted"),
    dark: false,
  },
  dark: {
    bgs: [...hexes("bgPresetsDark"), constant("BG_DEFAULT_DARK")].filter(Boolean),
    surface: v(block("\\.dark"), "surface"),
    text: v(block("\\.dark"), "text"),
    muted: v(block("\\.dark"), "text-muted"),
    dark: true,
  },
};
const accents = hexes("accentPresets");
const rows = [];
let fail = 0;
const check = (label, ratio, min = 4.5) => {
  const ok = ratio >= min;
  if (!ok) fail++;
  rows.push(`${ok ? "OK  " : "FAIL"} ${ratio.toFixed(2).padStart(5)}  ${label}`);
};
for (const [name, m] of Object.entries(modes)) {
  const surface = parseHex(m.surface);
  for (const bgHex of [...new Set(m.bgs)]) {
    const bg = parseHex(bgHex);
    check(`${name} · text-muted on ${bgHex}`, contrastRatio(parseHex(m.muted), bg));
    check(`${name} · text on ${bgHex}`, contrastRatio(parseHex(m.text), bg));
    for (const a of accents) {
      const r = accessibleAccent(a, [bg, surface], m.dark);
      check(`${name} · accent ${a} as text on ${bgHex}`, r.textContrast, 4.5);
      check(`${name} · on-accent text over ${a} (bg ${bgHex})`, r.buttonContrast, 4.5);
    }
  }
  check(`${name} · text-muted on surface ${m.surface}`, contrastRatio(parseHex(m.muted), surface));
}
const verbose = process.argv.includes("--verbose");
console.log((verbose ? rows : rows.filter((r) => r.startsWith("FAIL"))).join("\n"));
console.log(`\nKombinasi diperiksa: ${rows.length} · gagal: ${fail}`);
process.exit(fail ? 1 : 0);
