#!/usr/bin/env node
/**
 * Alat kamus bahasa (v0.57).
 *
 *   node scripts/i18n.mjs check     → gagal (exit 1) bila ada teks UI yang belum punya padanan Inggris di lib/locales/en.ts
 *   node scripts/i18n.mjs missing   → daftar teks yang belum diterjemahkan (JSON)
 *   node scripts/i18n.mjs unused    → entri kamus yang tidak lagi dipakai di kode
 *
 * Kunci kamus = teks Indonesia apa adanya. Yang dikumpulkan:
 *  1. argumen pertama t("…") / tr("…") / trn("…")
 *  2. title/message literal pada notifyToast({…}) / toastWithUndo({…})
 *  3. nilai teks pada konstanta UI bernama (lihat CONSTANT_SOURCES)
 *  4. pesan error/message yang dikirim API ke UI (app/api/**, lib/sync, lib/ai/errors)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  console.error("Butuh paket 'typescript' (npm install).");
  process.exit(2);
}

const ROOT = process.cwd();
const T_NAMES = new Set(["t", "tr", "trn"]);
const TOAST_CALLS = new Set(["notifyToast", "toastWithUndo"]);
const UI_KEYS = new Set([
  "title",
  "label",
  "detail",
  "description",
  "hint",
  "subtitle",
  "name",
  "text",
  "cta",
  "desc",
  "summary",
  "heading",
  "tooltip",
  "body",
  "caption",
  "badge",
  "eyebrow",
  "helper",
  "example",
  "category",
  "message",
  "empty",
  "l",
  "help",
]);
const ARRAY_KEYS = new Set(["steps", "examples", "tips", "items", "points"]);
/** berkas → nama konstanta modul yang nilainya tampil di UI */
const CONSTANT_SOURCES = {
  "app/(app)/guide/page.tsx": ["guide", "quickPrompts"],
  "lib/shortcuts.ts": ["SHORTCUT_HELP", "GO_TO"],
  "lib/dashboardLayout.ts": ["DASHBOARD_WIDGETS"],
  "components/v35/CommandCenter.tsx": ["PAGES", "COMMANDS"],
  "app/(app)/knowledge/page.tsx": ["items"],
  "app/(app)/wellbeing/page.tsx": ["items"],
  "components/v36/AIModeGuide.tsx": ["modes"],
  "components/tasks/TaskViews.tsx": ["QUADRANT_META", "STATUS_LABEL", "PRIORITY_LABEL"],
  "app/(app)/inbox/page.tsx": ["meta"],
  "app/(app)/notes/page.tsx": ["templates"],
  "app/(app)/settings/page.tsx": ["sections"],
  "components/settings/ThemeModeControl.tsx": ["OPTIONS"],
  "app/(app)/tasks/page.tsx": ["statusMeta"],
  "lib/theme.ts": ["fontPresets", "accentPresets", "bgPresetsDark", "bgPresetsLight"],
  "lib/date.ts": ["TIMEZONE_OPTIONS"],
  "components/layout/nav-items.ts": ["*"],
  "lib/v35/featureRegistry.ts": ["V35_FEATURES"],
  "lib/onboarding.ts": ["*"],
  "app/(app)/automations/page.tsx": ["triggers", "actions", "templates", "presets"],
  "app/(app)/command/page.tsx": ["presets"],
  "app/(app)/decisions/page.tsx": ["resultLabels"],
};
const API_DIRS = ["app/api"];
const API_KEYS = new Set(["error", "message", "detail", "hint"]);
const hasLetters = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s);
const looksLikeCode = (s) => /^[a-z0-9_:/.#\-[\]%@]+$/i.test(s) && !/\s/.test(s) && s === s.toLowerCase();

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!["node_modules", ".next", "native", "tests"].includes(e.name)) walk(p, out);
    } else if (/\.tsx?$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

export function collectPhrases() {
  const phrases = new Map(); // frasa → Set(berkas)
  const add = (text, file) => {
    if (text && hasLetters(text)) {
      if (!phrases.has(text)) phrases.set(text, new Set());
      phrases.get(text).add(file);
    }
  };
  const files = [
    ...walk(path.join(ROOT, "app")),
    ...walk(path.join(ROOT, "components")),
    ...walk(path.join(ROOT, "lib")),
  ];
  for (const file of files) {
    const r = rel(file);
    const src = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(
      file,
      src,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const isApi = API_DIRS.some((d) => r.startsWith(d + "/"));
    const constNames = CONSTANT_SOURCES[r];

    const collectStrings = (node) => {
      (function v(n) {
        if (ts.isPropertyAssignment(n) && n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) {
          const key = n.name.text;
          const text = literalText(n.initializer);
          if (text !== null && UI_KEYS.has(key) && !looksLikeCode(text)) add(text, r);
          if (ARRAY_KEYS.has(key) && ts.isArrayLiteralExpression(n.initializer))
            for (const el of n.initializer.elements) {
              const t = literalText(el);
              if (t !== null && !looksLikeCode(t)) add(t, r);
            }
        }
        ts.forEachChild(n, v);
      })(node);
    };

    (function visit(n) {
      if (
        ts.isJsxAttribute(n) &&
        n.name.getText() === "title" &&
        n.initializer &&
        ts.isStringLiteral(n.initializer) &&
        /(^|\/)loading\.tsx$/.test(r)
      )
        add(n.initializer.text, r);
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        if (ts.isIdentifier(callee) && T_NAMES.has(callee.text) && n.arguments[0]) {
          const text = literalText(n.arguments[0]);
          if (text !== null) add(text, r);
        }
        if (
          ts.isIdentifier(callee) &&
          TOAST_CALLS.has(callee.text) &&
          n.arguments[0] &&
          ts.isObjectLiteralExpression(n.arguments[0])
        ) {
          for (const prop of n.arguments[0].properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const key = prop.name.getText();
            if (key === "title" || key === "message" || key === "undoLabel") {
              const text = literalText(prop.initializer);
              if (text !== null) add(text, r);
              if (ts.isConditionalExpression(prop.initializer))
                for (const b of [prop.initializer.whenTrue, prop.initializer.whenFalse]) {
                  const t = literalText(b);
                  if (t !== null) add(t, r);
                }
            }
          }
        }
      }
      if (isApi && ts.isPropertyAssignment(n) && n.name && API_KEYS.has(n.name.getText().replace(/["']/g, ""))) {
        const text = literalText(n.initializer);
        if (text !== null && /\s/.test(text)) add(text, r);
      }
      ts.forEachChild(n, visit);
    })(sf);

    if (constNames) {
      for (const st of sf.statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || !d.initializer) continue;
          if (constNames.includes("*") || constNames.includes(d.name.text)) {
            // array string biasa (mis. quickPrompts) ikut dikumpulkan
            let init = d.initializer;
            if (ts.isAsExpression(init)) init = init.expression;
            if (ts.isArrayLiteralExpression(init))
              for (const el of init.elements) {
                const t = literalText(el);
                if (t !== null && /\s/.test(t)) add(t, r);
              }
            collectStrings(d.initializer);
          }
        }
      }
    }
  }
  return phrases;
}

function loadLegacyKeys() {
  const src = fs.readFileSync(path.join(ROOT, "lib/i18n.ts"), "utf8");
  const sf = ts.createSourceFile("i18n.ts", src, ts.ScriptTarget.Latest, true);
  const keys = new Set();
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (d.name.getText() === "translations" && d.initializer) {
        (function v(n) {
          if (ts.isPropertyAssignment(n) && n.name) keys.add(n.name.getText().replace(/^["']|["']$/g, ""));
          ts.forEachChild(n, v);
        })(d.initializer);
      }
    }
  }
  return keys;
}

function loadEnglish() {
  const src = fs.readFileSync(path.join(ROOT, "lib/locales/en.ts"), "utf8");
  const sf = ts.createSourceFile("en.ts", src, ts.ScriptTarget.Latest, true);
  const map = new Map();
  (function v(n) {
    if (
      ts.isPropertyAssignment(n) &&
      n.name &&
      (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name)) &&
      n.initializer &&
      (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))
    )
      map.set(n.name.text, n.initializer.text);
    ts.forEachChild(n, v);
  })(sf);
  return map;
}

/** Frasa yang sama di kedua bahasa (nama merek, singkatan, simbol) tidak perlu padanan. */
const INVARIANT =
  /^(Licia|WIB|WITA|WIT|AI|PWA|OK|Email|Google|Supabase|PDF|CSV|JSON|URL|API|Ctrl|Cmd|Esc|Enter|Tab|Shift|Alt|N\/A|—|–|-)$/i;

const [, , cmd = "check"] = process.argv;
if (process.argv[1] && process.argv[1].endsWith("i18n.mjs")) {
  const phrases = collectPhrases();
  const legacy = loadLegacyKeys();
  const en = loadEnglish();
  const missing = [...phrases.keys()].filter(
    (p) =>
      !legacy.has(p) &&
      !en.has(p) &&
      !INVARIANT.test(p.trim()) &&
      !/^[\d\s.,:;%/+\-–—·•→←×()[\]{}#@!?"'`~|&*=<>_\\]+$/.test(p),
  );
  if (cmd === "missing") {
    console.log(JSON.stringify(missing, null, 1));
  } else if (cmd === "unused") {
    const unused = [...en.keys()].filter((k) => !phrases.has(k));
    console.log(`${unused.length} entri kamus tidak terdeteksi di kode (bisa dinamis atau sisa):`);
    for (const k of unused.slice(0, 80)) console.log("  -", k);
  } else {
    if (missing.length) {
      console.error(`✗ ${missing.length} teks UI belum punya terjemahan Inggris (lib/locales/en.ts):`);
      for (const p of missing.slice(0, 40)) console.error("  -", JSON.stringify(p));
      if (missing.length > 40) console.error(`  … dan ${missing.length - 40} lainnya`);
      process.exit(1);
    }
    console.log(`✓ i18n lengkap: ${phrases.size} teks terdeteksi, ${en.size} padanan Inggris.`);
  }
}
