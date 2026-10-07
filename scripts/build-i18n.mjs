#!/usr/bin/env node
/**
 * Membangun lib/i18n/en.ts dari i18n-src/keys.json (kunci Indonesia hasil codemod/pindai)
 * dan i18n-src/en.json (peta "teks Indonesia" → "English"). Nilai yang sama dengan kuncinya boleh dilewati.
 *   npm run i18n:build   -> menulis lib/i18n/en.ts
 *   npm run i18n:check   -> gagal (exit 1) bila ada kunci tanpa terjemahan / placeholder tidak cocok
 */
import fs from "node:fs";

const check = process.argv.includes("--check");
const keys = JSON.parse(fs.readFileSync("i18n-src/keys.json", "utf8")).map((k) => k.key);
const en = JSON.parse(fs.readFileSync("i18n-src/en.json", "utf8"));
const manual = fs.existsSync("i18n-src/manual.json") ? JSON.parse(fs.readFileSync("i18n-src/manual.json", "utf8")) : {};
const names = (s) => [...new Set([...s.matchAll(/\{(\w+)(?::[^{}]*)?\}/g)].map((m) => m[1]))].sort().join(",");
const problems = [];
const entries = {};
for (const key of keys) {
  const raw = en[key];
  if (raw === undefined) {
    problems.push(`belum diterjemahkan: ${key.slice(0, 70)}`);
    continue;
  }
  if (names(key) !== names(raw)) problems.push(`placeholder tidak cocok: ${key.slice(0, 50)} -> ${raw.slice(0, 50)}`);
  if (raw !== key) entries[key] = raw;
}
for (const [k, v] of Object.entries({ ...en, ...manual })) if (!keys.includes(k) && v !== k) entries[k] = v; // entri tambahan manual
Object.assign(entries, manual);
const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
if (!check) {
  const body = Object.entries(sorted)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  fs.writeFileSync(
    "lib/i18n/en.ts",
    `/**\n * Kamus teks-sumber Indonesia → Inggris (${Object.keys(sorted).length} entri). DIHASILKAN oleh scripts/build-i18n.mjs\n * dari i18n-src/en.json. Jangan sunting manual; ubah sumbernya lalu jalankan \`npm run i18n:build\`.\n * Teks yang tidak ada di sini tampil apa adanya (Indonesia) — tidak pernah kosong.\n */\nexport const EN_SOURCE: Record<string, string> = {\n${body}\n};\n`,
  );
}
console.log(`kunci: ${keys.length}, entri kamus: ${Object.keys(sorted).length}, masalah: ${problems.length}`);
if (problems.length) console.log(problems.slice(0, 40).join("\n"));
if (problems.length) process.exit(1);
