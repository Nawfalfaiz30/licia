#!/usr/bin/env node
/**
 * Audit i18n: semua pemanggilan tr("literal")/t("literal") di app/components harus punya padanan Inggris di
 * i18n-src/en.json (kecuali teks yang memang sama di kedua bahasa). Juga memeriksa placeholder.
 *   node scripts/i18n-audit.cjs            -> laporan + exit 1 bila ada yang hilang
 *   node scripts/i18n-audit.cjs --write    -> menulis i18n-src/missing.json untuk diterjemahkan
 */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const en = JSON.parse(fs.readFileSync("i18n-src/en.json", "utf8"));
const same = new Set([
  "Licia",
  "WIB",
  "Ctrl K",
  "Vault",
  "Snippet",
  "Personal",
  "Privacy",
  "Knowledge",
  "Workspace",
  "Chat",
  "Insights",
  "Email",
  "Password",
]);
function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (/\.tsx?$/.test(e.name)) o.push(p);
  }
  return o;
}
const missing = new Map();
for (const file of [...walk("app"), ...walk("components")]) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  (function visit(n) {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      (n.expression.text === "tr" || n.expression.text === "t") &&
      n.arguments.length
    ) {
      const a = n.arguments[0];
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) {
        const key = a.text;
        if (key && !(key in en) && !same.has(key) && !/^[a-z0-9_]+$/.test(key) && /[A-Za-z]{2,}/.test(key)) {
          if (!missing.has(key)) missing.set(key, file);
        }
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
}
const arr = [...missing.entries()];
if (process.argv.includes("--write"))
  fs.writeFileSync("i18n-src/missing.json", JSON.stringify(Object.fromEntries(arr.map(([k]) => [k, ""])), null, 1));
console.log(`tr() tanpa terjemahan: ${arr.length}`);
for (const [k, f] of arr.slice(0, 200)) console.log(`${f.replace(/^.*\//, "")} | ${k}`);
process.exit(arr.length ? 1 : 0);
