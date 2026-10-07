import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
const root = process.cwd();
const required = [
  "supabase/schema_v32_sync_experience.sql",
  "components/sync/ConflictCenter.tsx",
  "lib/sync/conflict.ts",
  "lib/ai/contextCache.ts",
  "components/SyncManager.tsx",
  "components/PWARegister.tsx",
  "public/sw.js",
];
let failed = false;
for (const file of required)
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`MISSING: ${file}`);
    failed = true;
  }
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== "0.32.0") {
  console.error("PACKAGE VERSION MUST BE 0.32.0");
  failed = true;
}
const schema = fs.readFileSync(path.join(root, "supabase/schema_v32_sync_experience.sql"), "utf8");
for (const token of ["life_os_sync_conflicts", "licia_prune_sync_history", "life_os_sync_mutations_status_created_idx"])
  if (!schema.includes(token)) {
    console.error(`SCHEMA TOKEN MISSING: ${token}`);
    failed = true;
  }
const language = fs.readFileSync(path.join(root, "components/LanguageProvider.tsx"), "utf8");
if (language.includes('applyLanguage("id")')) {
  console.error("LANGUAGE PROVIDER REGRESSION");
  failed = true;
}
const mutation = fs.readFileSync(path.join(root, "app/api/sync/mutation/route.ts"), "utf8");
for (const token of ["const conflictId = await createConflict", "conflictId,"])
  if (!mutation.includes(token)) {
    console.error(`MUTATION CONFLICT ID MISSING: ${token}`);
    failed = true;
  }
const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
if (!sw.includes("licia-v32-pwa-r3")) {
  console.error("SW V32 CACHE TOKEN MISSING");
  failed = true;
}
try {
  const tsPath = execSync("node -e \"console.log(require.resolve('typescript'))\"", { encoding: "utf8" }).trim();
  const ts = await import(tsPath);
  let errors = 0,
    count = 0;
  const roots = ["app", "components", "lib"];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) {
        count++;
        const src = fs.readFileSync(p, "utf8");
        const sf = ts.createSourceFile(
          p,
          src,
          ts.ScriptTarget.Latest,
          true,
          p.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        if (sf.parseDiagnostics?.length) {
          console.error(`PARSE ERROR: ${path.relative(root, p)}`);
          errors += sf.parseDiagnostics.length;
        }
      }
    }
  }
  for (const r of roots) walk(path.join(root, r));
  console.log(`V32 parser check: ${count} TS/TSX files, ${errors} syntax errors`);
  if (errors) failed = true;
} catch (e) {
  console.warn("V32 parser check skipped:", e?.message || e);
}
if (failed) process.exit(1);
console.log("Licia V32 verification passed.");
