#!/usr/bin/env node
/** Mengganti locale "id-ID" yang tertulis langsung di UI dengan `locale` dari bahasa pengguna. Idempoten. */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const isFn = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n);
const nameOf = (n) => (n.name && n.name.text) || (n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) ? n.parent.name.text : null);
const isComp = (nm) => !!nm && /^[A-Z]/.test(nm);
function walk(d, o = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, o); else if (/\.tsx$/.test(e.name)) o.push(p); } return o; }
const report = [];
for (const file of [...walk("app"), ...walk("components")]) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes('"id-ID"')) continue;
  const rel = file.split(path.sep).join("/");
  if (rel === "components/LanguageProvider.tsx") continue;
  const isClient = /^\s*["']use client["']/.test(src);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = []; const helperFix = new Map(); const compNeeds = new Set(); let manual = 0;
  const calls = [];
  (function visit(n) {
    if (ts.isStringLiteral(n) && n.text === "id-ID") {
      let helper = null, comp = null;
      for (let p = n.parent; p; p = p.parent) if (isFn(p)) { const nm = nameOf(p); if (isComp(nm)) { comp = p; break; } if (!helper) helper = p; }
      if (comp && (!helper || helper.parent === comp.body || true)) {
        // fungsi pembantu di dalam komponen tetap bisa memakai closure `locale`; yang di luar komponen perlu parameter
        let outerHelper = null;
        for (let p = n.parent; p; p = p.parent) { if (isFn(p) && !isComp(nameOf(p))) outerHelper = p; if (p === comp) break; }
        edits.push({ s: n.getStart(sf), e: n.getEnd(), t: "locale" }); compNeeds.add(comp);
      } else if (helper && helper.parent && helper.parent.kind === ts.SyntaxKind.SourceFile || (helper && ts.isVariableDeclaration(helper.parent) && helper.parent.parent.parent.kind === ts.SyntaxKind.VariableStatement && helper.parent.parent.parent.parent.kind === ts.SyntaxKind.SourceFile)) {
        edits.push({ s: n.getStart(sf), e: n.getEnd(), t: "locale" }); helperFix.set(helper, nameOf(helper));
      } else { manual++; report.push(`${rel}: id-ID manual`); }
    }
    ts.forEachChild(n, visit);
  })(sf);
  if (!edits.length) continue;
  // parameter pembantu
  const helperNames = new Map();
  for (const [fn, nm] of helperFix) {
    if (!nm) { report.push(`${rel}: helper tanpa nama`); continue; }
    const params = fn.parameters;
    const last = params[params.length - 1];
    if (last && last.dotDotDotToken) { report.push(`${rel}: ${nm} rest param`); continue; }
    helperNames.set(nm, params.length);
    const insertAt = params.length ? last.getEnd() : (fn.body ? fn.getChildren(sf).find((c) => c.kind === ts.SyntaxKind.OpenParenToken).getEnd() : 0);
    edits.push({ s: insertAt, e: insertAt, t: (params.length ? ", " : "") + 'locale: string = "id-ID"' });
  }
  (function findCalls(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && helperNames.has(n.expression.text)) {
      const want = helperNames.get(n.expression.text);
      let inComp = null; for (let p = n.parent; p; p = p.parent) if (isFn(p) && isComp(nameOf(p))) { inComp = p; break; }
      if (n.arguments.length === want && inComp) { const at = n.arguments.length ? n.arguments[n.arguments.length - 1].getEnd() : n.expression.getEnd() + 1; edits.push({ s: at, e: at, t: (n.arguments.length ? ", " : "") + "locale" }); compNeeds.add(inComp); }
      else if (n.arguments.length !== want) report.push(`${rel}: panggilan ${n.expression.text} argumen tidak sesuai`);
    }
    ts.forEachChild(n, findCalls);
  })(sf);
  // pastikan `locale` tersedia di komponen
  for (const comp of compNeeds) {
    const txt = comp.getText(sf);
    const hook = isClient ? /const \{ tr \} = useLanguage\(\);/ : /const \{ tr \} = await getServerI18n\(\);/;
    const m = hook.exec(txt);
    if (m) {
      const at = comp.getStart(sf) + m.index;
      edits.push({ s: at, e: at + m[0].length, t: isClient ? "const { tr, locale } = useLanguage();" : "const { tr, locale } = await getServerI18n();" });
    } else if (!/const \{[^}]*locale[^}]*\} = (useLanguage|await getServerI18n)\(\)/.test(txt)) {
      const body = comp.body;
      if (ts.isBlock(body)) edits.push({ s: body.getStart(sf) + 1, e: body.getStart(sf) + 1, t: `\n  const { locale } = ${isClient ? "useLanguage()" : "await getServerI18n()"};` });
      else report.push(`${rel}: komponen ekspresi tanpa hook`);
      // impor
      const marker = isClient ? "useLanguage" : "getServerI18n";
      if (!new RegExp(`import[^;]*\\b${marker}\\b[^;]*from`).test(src)) {
        let last = 0; sf.statements.forEach((st) => { if (ts.isImportDeclaration(st)) last = st.getEnd(); });
        const line = isClient ? 'import { useLanguage } from "@/components/LanguageProvider";' : 'import { getServerI18n } from "@/lib/i18n/server";';
        edits.push({ s: last, e: last, t: "\n" + line });
      }
      if (!isClient && !(comp.modifiers && comp.modifiers.some((m2) => m2.kind === ts.SyntaxKind.AsyncKeyword)) && ts.isFunctionDeclaration(comp)) {
        const kw = comp.getChildren(sf).find((c) => c.kind === ts.SyntaxKind.FunctionKeyword); edits.push({ s: kw.getStart(sf), e: kw.getStart(sf), t: "async " });
      }
    }
  }
  edits.sort((a, b) => b.s - a.s || b.e - a.e);
  const seen = new Set();
  for (const e of edits) { const k = e.s + ":" + e.e + ":" + e.t; if (seen.has(k)) continue; seen.add(k); src = src.slice(0, e.s) + e.t + src.slice(e.e); }
  fs.writeFileSync(file, src);
}
console.log(report.length ? report.join("\n") : "locale codemod selesai tanpa catatan");
