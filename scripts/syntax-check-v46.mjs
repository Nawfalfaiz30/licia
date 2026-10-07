import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js");
const root = process.cwd();
const changed = [
  "components/layout/nav-items.ts",
  "components/layout/MoreSheet.tsx",
  "components/layout/BottomNav.tsx",
  "components/chat/ChatWidget.tsx",
  "app/(app)/finance/page.tsx",
  "app/(app)/guide/page.tsx",
  "app/(app)/settings/page.tsx",
  "app/(app)/tasks/page.tsx",
  "lib/i18n.ts",
];
const errors = [];
for (const rel of changed) {
  const file = path.join(root, rel);
  const source = fs.readFileSync(file, "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      sourceMap: false,
    },
    fileName: rel,
    reportDiagnostics: true,
  });
  const diagnostics = out.diagnostics || [];
  for (const d of diagnostics) {
    errors.push(`${rel}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
  }
}
if (errors.length) {
  console.error("V46 syntax check failed");
  for (const e of errors) console.error("-", e);
  process.exit(1);
}
console.log(`V46 syntax check OK — ${changed.length} TS/TSX files transpiled`);
