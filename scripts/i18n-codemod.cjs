#!/usr/bin/env node
/**
 * Codemod i18n (v0.57): membungkus teks UI berbahasa Indonesia yang tertulis langsung di komponen
 * dengan `tr("…")` supaya bisa diterjemahkan lewat kamus `lib/i18n/en.ts`.
 *
 *   node scripts/i18n-codemod.cjs collect   -> tulis i18n-src/keys.json + laporan situs yang dilewati
 *   node scripts/i18n-codemod.cjs apply     -> ubah berkas sumber (sekali jalan; idempoten)
 *
 * Aturan keamanan: hanya situs "pasti teks tampilan" yang dibungkus (teks JSX, atribut label,
 * nilai properti title/message/label/…, argumen setError/Error/confirm, return/inisialisasi di dalam
 * komponen). Perbandingan (===), case, argumen query/storage, dan tipe literal TIDAK pernah disentuh.
 * Situs di luar komponen (konstanta modul, helper murni) hanya dilaporkan untuk ditangani manual.
 */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const MODE = process.argv[2] === "apply" ? "apply" : "collect";
const ROOTS = ["app", "components"];
const SKIP_FILES = new Set([
  "components/LanguageProvider.tsx",
  "components/ui/Skeleton.tsx",
  "components/chat/MarkdownLite.tsx",
  "components/layout/SkipLink.tsx",
  "app/layout.tsx",
]);
const ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label", "description", "hint", "confirmLabel", "cancelLabel", "submitLabel", "emptyText", "subtitle", "tooltip", "helper", "aria-description", "aria-placeholder", "summary", "heading", "eyebrow", "caption", "actionLabel"]);
const KEYS = new Set(["title", "message", "label", "text", "description", "hint", "desc", "subtitle", "sub", "caption", "heading", "placeholder", "helper", "tooltip", "empty", "emptyTitle", "emptyText", "cta", "summary", "detail", "note", "reason", "error", "warning", "success", "info", "headline", "tagline", "badge", "tip", "question", "answer", "eyebrow", "body", "actionLabel", "confirmLabel", "cancelLabel", "submitLabel"]);
const CALLEES = /^(set(Error|Message|Status|Notice|Info|Feedback|Result|Toast|Hint|Warning|Success|Text|Msg|Note)|alert|confirm|prompt|showActionResult|notify|toast)$/;
const SKIP_JSX_TAGS = new Set(["kbd", "code", "pre", "style", "script"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", middot: "·", hellip: "…", mdash: "—", ndash: "–", rarr: "→", larr: "←", times: "×", bull: "•", copy: "©", laquo: "«", raquo: "»" };
const CSSY = /\b(rounded|flex|grid|px-\d|py-\d|bg-|text-\[|text-(xs|sm|lg|xl)|border-|w-\d|h-\d|gap-\d|items-|justify-|licia-|absolute|relative|hover:|sm:|md:|lg:|animate-|shadow-|font-)/;

const keys = new Map(); // key -> {file, count}
const skipped = { moduleLevel: [], helper: [], serverNonAsync: [], entity: [], noScope: [] };
let wrappedTotal = 0;
let changedFiles = 0;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(entry.name)) out.push(p);
  }
  return out;
}

const isFn = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
function fnName(n) {
  if (n.name && n.name.text) return n.name.text;
  let p = n.parent;
  if (p && ts.isCallExpression(p)) p = p.parent; // memo(function X) / forwardRef((…) => …)
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && (ts.isExportAssignment(p))) return "Default";
  return null;
}
const isComponentName = (nm) => !!nm && (/^[A-Z]/.test(nm) || /^use[A-Z]/.test(nm));
const hasAsync = (n) => !!(n.modifiers && n.modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword));

function looksHuman(text, strong) {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 600) return false;
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(s)) return false;
  if (CSSY.test(s)) return false;
  if (/^(https?:|\/|#|\.|[\w.-]+@[\w.-]+\.\w+$)/.test(s)) return false;
  if (!/\s/.test(s)) {
    if (/[/_.\-:=]/.test(s) && !/…$/.test(s)) return false;
    if (/^[a-z]/.test(s)) return false; // identifier / kode
    if (strong && s.length < 4) return false;
  }
  return true;
}

function transparent(n) {
  const p = n.parent;
  if (!p) return false;
  if (ts.isParenthesizedExpression(p) || ts.isNonNullExpression(p)) return true;
  if (ts.isAsExpression(p) || ts.isSatisfiesExpression?.(p)) return false; // `as const`: biarkan manual
  if (ts.isConditionalExpression(p)) return p.whenTrue === n || p.whenFalse === n;
  if (ts.isBinaryExpression(p)) {
    const op = p.operatorToken.kind;
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return true;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return p.right === n;
  }
  return false;
}

function propName(p) {
  if (ts.isIdentifier(p.name)) return p.name.text;
  if (ts.isStringLiteral(p.name)) return p.name.text;
  return null;
}

/** Konteks tempat string literal pasti berupa teks tampilan? Mengembalikan "weak" | "strong" | null. */
function contextOf(node) {
  let n = node;
  while (transparent(n)) n = n.parent;
  const p = n.parent;
  if (!p) return null;
  if (ts.isJsxExpression(p)) {
    const gp = p.parent;
    if (ts.isJsxAttribute(gp)) return ATTRS.has(gp.name.getText()) ? "weak" : null;
    return "weak"; // anak elemen JSX
  }
  if (ts.isPropertyAssignment(p) && p.initializer === n) {
    const name = propName(p);
    return name && KEYS.has(name) ? "weak" : null;
  }
  if (ts.isCallExpression(p) && p.arguments[0] === n) {
    const callee = ts.isIdentifier(p.expression) ? p.expression.text : ts.isPropertyAccessExpression(p.expression) ? p.expression.name.text : "";
    return CALLEES.test(callee) ? "weak" : null;
  }
  if (ts.isNewExpression(p) && p.arguments && p.arguments[0] === n && ts.isIdentifier(p.expression) && p.expression.text === "Error") return "weak";
  if (ts.isReturnStatement(p)) return "strong";
  if (ts.isVariableDeclaration(p) && p.initializer === n) return "strong";
  if (ts.isArrowFunction(p) && p.body === n) return "strong";
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && p.right === n) return "strong";
  return null;
}

function decodeJsxText(raw) {
  let ok = true;
  const text = raw.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, g) => {
    if (g[0] === "#") { try { return String.fromCodePoint(g[1].toLowerCase() === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10)); } catch { ok = false; return m; } }
    if (ENTITIES[g] !== undefined) return ENTITIES[g];
    ok = false; return m;
  });
  return { text, ok };
}

function processFile(file) {
  const rel = file.split(path.sep).join("/");
  if (SKIP_FILES.has(rel)) return;
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const isClient = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*["']use client["']/.test(src);
  const edits = []; // {start,end,text}
  const needs = new Map(); // function node -> true
  const makeAsync = new Map();
  const fileKeys = [];

  function scopeOf(node) {
    let outer = null;
    let sawPlain = false;
    for (let p = node.parent; p; p = p.parent) {
      if (!isFn(p)) continue;
      const nm = fnName(p);
      if (isComponentName(nm)) { outer = p; sawPlain = false; }
      else if (!outer) sawPlain = true;
      else sawPlain = sawPlain; // fungsi biasa di dalam komponen: tidak masalah
    }
    return { outer, sawPlain };
  }

  function register(node, key, replacement, kind) {
    const { outer, sawPlain } = scopeOf(node);
    if (!outer) {
      (sawPlain ? skipped.helper : skipped.moduleLevel).push(`${rel}: ${key.slice(0, 70)}`);
      return false;
    }
    // fungsi biasa di LUAR komponen terluar (HOC) tidak didukung
    let bad = false;
    for (let p = outer.parent; p; p = p.parent) if (isFn(p)) { bad = true; break; }
    if (bad) { skipped.noScope.push(`${rel}: ${key.slice(0, 70)}`); return false; }
    if (!isClient && !hasAsync(outer)) {
      // Komponen server: ubah deklarasi fungsi menjadi async (React 19 mendukung RSC async).
      if (ts.isFunctionDeclaration(outer) && !makeAsync.has(outer)) makeAsync.set(outer, true);
      if (!ts.isFunctionDeclaration(outer)) { skipped.serverNonAsync.push(`${rel}: ${key.slice(0, 70)}`); return false; }
    }
    needs.set(outer, true);
    edits.push({ start: node.getStart(sf), end: node.getEnd(), text: replacement, kind });
    fileKeys.push(key);
    return true;
  }

  const callTr = (key, vars) => `tr(${JSON.stringify(key)}${vars ? `, [${vars.join(", ")}]` : ""})`;

  function templateKey(node) {
    // `teks ${a} lagi` -> {key:"teks {0} lagi", vars:["a"]}
    let key = node.head.text;
    const vars = [];
    node.templateSpans.forEach((span, i) => {
      key += `{${i}}` + span.literal.text;
      vars.push(span.expression.getText(sf));
    });
    return { key, vars };
  }

  function visit(node) {
    // --- teks JSX
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      const parent = node.parent;
      const tag = parent && ts.isJsxElement(parent) ? parent.openingElement.tagName.getText(sf) : "";
      if (SKIP_JSX_TAGS.has(tag)) return;
      if (!/[A-Za-zÀ-ÿ]{2,}/.test(raw)) return;
      const { text, ok } = decodeJsxText(raw);
      if (!ok) { skipped.entity.push(`${rel}: ${raw.trim().slice(0, 60)}`); return; }
      const core = text.replace(/\s+/g, " ").trim();
      if (!looksHuman(core, false) && !/\s/.test(core) && !/^[A-ZÀ-Ý]/.test(core)) {
        // kata tunggal berhuruf kecil di JSX tetap teks tampilan (mis. "menit")
        if (!/^[a-zà-ÿ]{2,}[.,:;!?…]*$/.test(core)) return;
      } else if (CSSY.test(core)) return;
      const lead = /^\s*/.exec(raw)[0];
      const trail = /\s*$/.exec(raw)[0];
      const keepLead = lead && !lead.includes("\n") ? lead : "";
      const keepTrail = trail && !trail.includes("\n") ? trail : "";
      register(node, core, `${keepLead}{${callTr(core)}}${keepTrail}`, "jsx");
      return;
    }
    // --- atribut string
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && ATTRS.has(node.name.getText(sf))) {
      const value = node.initializer.text;
      if (looksHuman(value, false)) {
        const name = node.name.getText(sf);
        register(node.initializer, value, `{${callTr(value)}}`, "attr");
      }
      return;
    }
    if (ts.isJsxAttribute(node)) {
      // nilai lain (className, href, dst.) tidak disentuh, tetapi ekspresi di dalam {…} tetap ditelusuri
      if (node.initializer && ts.isJsxExpression(node.initializer)) ts.forEachChild(node.initializer, visit);
      return;
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return;
    if (ts.isCaseClause(node)) { node.statements.forEach(visit); return; }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(node.operatorToken.kind)) {
      // lewati operand literal, tetap telusuri sisi non-literal
      [node.left, node.right].forEach((c) => { if (!ts.isStringLiteral(c) && !ts.isNoSubstitutionTemplateLiteral(c)) visit(c); });
      return;
    }
    // --- string / template di konteks tampilan
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const ctx = contextOf(node);
      if (ctx && looksHuman(node.text, ctx === "strong")) register(node, node.text.replace(/\s+/g, " ").trim() === node.text ? node.text : node.text, callTr(node.text), "str");
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const ctx = contextOf(node);
      const { key, vars } = templateKey(node);
      const staticText = key.replace(/\{\d+\}/g, " ");
      if (ctx && looksHuman(staticText, ctx === "strong") && /[A-Za-zÀ-ÿ]{3,}/.test(staticText) && !CSSY.test(staticText)) {
        register(node, key, callTr(key, vars), "tpl");
        return; // jangan telusuri ekspresi di dalam
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  for (const k of fileKeys) {
    const entry = keys.get(k) || { file: rel, count: 0 };
    entry.count++;
    keys.set(k, entry);
  }
  wrappedTotal += fileKeys.length;
  if (MODE !== "apply" || !edits.length) return;

  // --- injeksi hook
  const serverMode = !isClient;
  for (const fn of makeAsync.keys()) {
    const kw = fn.getChildren(sf).find((c) => c.kind === ts.SyntaxKind.FunctionKeyword);
    if (kw) edits.push({ start: kw.getStart(sf), end: kw.getStart(sf), text: "async ", kind: "async" });
  }
  for (const fn of needs.keys()) {
    const body = fn.body;
    const decl = serverMode ? "const { tr } = await getServerI18n();" : "const { tr } = useLanguage();";
    if (ts.isBlock(body)) {
      edits.push({ start: body.getStart(sf) + 1, end: body.getStart(sf) + 1, text: `\n  ${decl}`, kind: "hook" });
    } else {
      const exprText = body.getText(sf);
      edits.push({ start: body.getStart(sf), end: body.getEnd(), text: `{\n  ${decl}\n  return (${exprText});\n}`, kind: "hookExpr" });
    }
  }
  // Edit di dalam body ekspresi yang dibungkus ulang akan bertabrakan; selesaikan dengan menerapkan edit dalam dulu.
  // Strategi: terapkan semua edit "dalam" terhadap teks, lalu bungkus. Untuk menyederhanakan, pisahkan hookExpr.
  const exprEdits = edits.filter((e) => e.kind === "hookExpr");
  const normal = edits.filter((e) => e.kind !== "hookExpr");
  normal.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = src;
  const applied = [];
  for (const e of normal) {
    if (applied.some((a) => e.start < a.end && e.end > a.start)) continue; // tumpang tindih: lewati
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    applied.push(e);
  }
  if (exprEdits.length) {
    // hitung ulang posisi dengan memparse hasil sementara
    const sf2 = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const targets = [];
    (function find(n) {
      if (isFn(n) && !ts.isBlock(n.body) && isComponentName(fnName(n))) {
        const outerCheck = (() => { for (let p = n.parent; p; p = p.parent) if (isFn(p)) return false; return true; })();
        if (outerCheck && /\btr\(/.test(n.body.getText(sf2)) && !/const \{ tr \}/.test(n.body.getText(sf2))) targets.push(n);
      }
      ts.forEachChild(n, find);
    })(sf2);
    targets.sort((a, b) => b.body.getStart(sf2) - a.body.getStart(sf2));
    const decl = serverMode ? "const { tr } = await getServerI18n();" : "const { tr } = useLanguage();";
    for (const fn of targets) {
      const b = fn.body;
      out = out.slice(0, b.getStart(sf2)) + `{\n  ${decl}\n  return (${b.getText(sf2)});\n}` + out.slice(b.getEnd());
    }
  }
  // --- impor
  const importLine = serverMode ? 'import { getServerI18n } from "@/lib/i18n/server";' : 'import { useLanguage } from "@/components/LanguageProvider";';
  const marker = serverMode ? "getServerI18n" : "useLanguage";
  if (!new RegExp(`import[^;]*\\b${marker}\\b[^;]*from`).test(out)) {
    const sf3 = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let lastImportEnd = 0;
    sf3.statements.forEach((s) => { if (ts.isImportDeclaration(s)) lastImportEnd = s.getEnd(); });
    out = lastImportEnd ? out.slice(0, lastImportEnd) + "\n" + importLine + out.slice(lastImportEnd) : importLine + "\n" + out;
  }
  fs.writeFileSync(file, out);
  changedFiles++;
}

for (const root of ROOTS) for (const f of walk(root)) processFile(f);

fs.mkdirSync("i18n-src", { recursive: true });
const arr = [...keys.entries()].map(([key, v], i) => ({ n: i + 1, key, file: v.file, count: v.count }));
if (MODE === "collect") fs.writeFileSync("i18n-src/keys.json", JSON.stringify(arr, null, 0));
fs.writeFileSync("i18n-src/skipped.txt", Object.entries(skipped).map(([k, v]) => `## ${k} (${v.length})\n${v.join("\n")}`).join("\n\n"));
console.log(`[${MODE}] situs dibungkus: ${wrappedTotal}, kunci unik: ${keys.size}, berkas diubah: ${changedFiles}`);
for (const [k, v] of Object.entries(skipped)) console.log(`  dilewati ${k}: ${v.length}`);
