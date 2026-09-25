import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const roots = ["app", "components", "lib"];
const required = [
  "app/(app)/settings/page.tsx",
  "app/(app)/error.tsx",
  "app/global-error.tsx",
  "app/api/chat/route.ts",
  "app/api/ai/undo/route.ts",
  "app/api/ai/batch/route.ts",
  "app/api/backup/route.ts",
  "app/(app)/ai-history/page.tsx",
  "components/settings/DataBackupButton.tsx",
  "components/chat/ChatWidget.tsx",
  "components/layout/TopBar.tsx",
  "lib/ai/tools.ts",
  "lib/ai/toolRouting.ts",
  "lib/ai/actionHistory.ts",
  "supabase/schema_all.sql",
  "ecosystem.config.cjs",
  "DEPLOY_VPS.md",
  "scripts/build.mjs",
  "components/PWARegister.tsx",
];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
for (const rootDir of roots) walk(path.join(root, rootDir));
let failed = false;
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`MISSING: ${rel}`);
    failed = true;
  }
}
const tsFiles = files.filter((f) => /\.(tsx?|ts)$/.test(f));
for (const file of tsFiles) {
  const source = fs.readFileSync(file, "utf8");
  // Command Center / Ctrl+K is an intentional Licia feature. Only flag a stale import to a removed component.
  if (path.relative(root, file) !== "scripts/verify.mjs" && /from\s+["']@\/components\/layout\/CommandPalette["']/.test(source)) {
    console.error(`STALE COMMAND PALETTE IMPORT: ${path.relative(root, file)}`);
    failed = true;
  }
  if (/sk-[A-Za-z0-9]{20,}/.test(source) || /service_role\s*[:=]/i.test(source)) {
    console.error(`POTENTIAL SECRET: ${path.relative(root, file)}`);
    failed = true;
  }
}
const settings = fs.readFileSync(path.join(root, "app/(app)/settings/page.tsx"), "utf8");
if (!/import .*SoftButton.*from ["']@\/components\/ui["']/.test(settings)) {
  console.error("Settings SoftButton import missing");
  failed = true;
}
const tools = fs.readFileSync(path.join(root, "lib/ai/tools.ts"), "utf8");
for (const name of ["update_decision", "delete_decision", "create_skill", "delete_skill"]) {
  if (!new RegExp(String.raw`name:\s*["']${name}["']`).test(tools)) {
    console.error(`AI TOOL DEF MISSING: ${name}`);
    failed = true;
  }
  if (!tools.includes(`case "${name}"`)) {
    console.error(`AI EXECUTOR MISSING: ${name}`);
    failed = true;
  }
}
const routing = fs.readFileSync(path.join(root, "lib/ai/toolRouting.ts"), "utf8");
if (!routing.includes('decisions: ["log_decision", "update_decision", "delete_decision"]')) {
  console.error("DECISION ROUTING MISSING");
  failed = true;
}
if (!routing.includes('learning: ["create_skill", "update_skill", "delete_skill"]')) {
  console.error("LEARNING ROUTING MISSING");
  failed = true;
}
if (fs.existsSync(path.join(root, "components/PwaRegister.tsx"))) {
  console.error("STALE PWA CASING FILE: components/PwaRegister.tsx");
  failed = true;
}
for (const stale of ["app/(app)/settings/page.client.tsx", "components/layout/CommandPalette.tsx"]) {
  if (fs.existsSync(path.join(root, stale))) {
    console.error(`STALE FILE PRESENT: ${stale}`);
    failed = true;
  }
}
const security = fs.readFileSync(path.join(root, "lib/security.ts"), "utf8");
for (const required of [
  "addDevelopmentLoopbackOrigins",
  "localhost:${port}",
  "127.0.0.1:${port}",
  "process.env.NODE_ENV === \"production\"",
  "x-forwarded-host",
  "x-forwarded-proto",
]) {
  if (!security.includes(required)) {
    console.error(`SECURITY GUARD REGRESSION: ${required}`);
    failed = true;
  }
}

const schema = fs.readFileSync(path.join(root, "supabase/schema_all.sql"), "utf8");
const searchRoute = fs.readFileSync(path.join(root, "app/api/search/route.ts"), "utf8");
if (searchRoute.includes('decisions").select("id,title,status,outcome"')) {
  console.error("SEARCH DECISIONS STATUS FIELD MISMATCH");
  failed = true;
}
const tasksPage = fs.readFileSync(path.join(root, "app/(app)/tasks/page.tsx"), "utf8");
if (/const I = Icon as typeof Timer/.test(tasksPage)) {
  console.error("TASK ICON UNION CAST REGRESSION");
  failed = true;
}
const weeklyPlanner = fs.readFileSync(path.join(root, "app/api/weekly-planner/route.ts"), "utf8");
if (/blocks:\s*\[\]\s*\}\)\);/.test(weeklyPlanner)) {
  console.error("WEEKLY PLANNER EMPTY-BLOCKS TYPE REGRESSION");
  failed = true;
}
const backupRoute = fs.readFileSync(path.join(root, "app/api/backup/route.ts"), "utf8");
if (!backupRoute.includes("enforceSameOrigin") || !backupRoute.includes("assertJsonSize") || !backupRoute.includes('mode:"merge"')) {
  console.error("BACKUP ROUTE SECURITY/MERGE GUARD MISSING");
  failed = true;
}
for (const table of ["ai_action_history", "ai_pending_actions"]) {
  if (!schema.includes(table)) {
    console.error(`SCHEMA REFERENCE MISSING: ${table}`);
    failed = true;
  }
}

for (const [file, pattern, message] of [
  ["app/(app)/settings/page.tsx", /font\.family|font\.id/, "SETTINGS FONT FIELD REGRESSION"],
  ["app/(app)/tasks/page.tsx", /completed_at/, "TASK COMPLETED_AT REGRESSION"],
  ["lib/getOrCreateProfile.ts", /select\("display_name"\)/, "PROFILE TIMEZONE SELECT REGRESSION"],
]) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const source = fs.readFileSync(full, "utf8");
  if (pattern.test(source)) {
    console.error(`${message}: ${file}`);
    failed = true;
  }
}
const automationRoute = fs.readFileSync(path.join(root, "app/api/automations/evaluate/route.ts"), "utf8");
if (!/export async function GET\s*\(/.test(automationRoute)) {
  console.error("AUTOMATION GET HANDLER MISSING: app/api/automations/evaluate/route.ts");
  failed = true;
}

const envFiles = [".env.local", ".env.production", ".env.development", ".env.test"];
for (const envFile of envFiles) {
  if (!fs.existsSync(path.join(root, envFile))) continue;
  console.error(`ENV FILE MUST NOT BE PACKAGED: ${envFile}`);
  failed = true;
}

const nginx = fs.readFileSync(path.join(root, "deploy/nginx-licia.conf"), "utf8");
if (!/server_name _;/.test(nginx)) {
  console.error("NGINX IP-ONLY DEFAULT SERVER NAME MISSING");
  failed = true;
}
const nextConfig = fs.readFileSync(path.join(root, "next.config.js"), "utf8");
if (/Strict-Transport-Security/.test(nextConfig) && !/usesHttpsOrigin/.test(nextConfig)) {
  console.error("HSTS CONFIGURATION IS NOT CONDITIONAL ON HTTPS ORIGIN");
  failed = true;
}

const localImportExts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css"];
function resolveLocalImport(spec, importer) {
  const base = spec.startsWith("@/")
    ? path.join(root, spec.slice(2))
    : path.resolve(path.dirname(importer), spec);
  const candidates = [base, ...localImportExts.map((ext) => `${base}${ext}`), ...localImportExts.map((ext) => path.join(base, `index${ext}`))];
  return candidates.find((candidate) => fs.existsSync(candidate));
}
for (const file of files.filter((f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f))) {
  const source = fs.readFileSync(file, "utf8");
  const importRe = /(?:import|export)\s+(?:[^'\";]*?\s+from\s+)?["']([^"']+)["']|import\s*\(["']([^"']+)["']\)/g;
  let match;
  while ((match = importRe.exec(source))) {
    const spec = match[1] || match[2];
    if (!spec || (!spec.startsWith("./") && !spec.startsWith("../") && !spec.startsWith("@/"))) continue;
    if (!resolveLocalImport(spec, file)) {
      console.error(`MISSING LOCAL IMPORT: ${path.relative(root, file)} -> ${spec}`);
      failed = true;
    }
  }
}
const nvmrc = fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim();
if (nvmrc !== "22") {
  console.error(`NVMRC MUST TARGET NODE 22 (found: ${nvmrc || "empty"})`);
  failed = true;
}
if (!fs.existsSync(path.join(root, "next-env.d.ts"))) {
  console.error("NEXT ENV TYPE DECLARATION MISSING: next-env.d.ts");
  failed = true;
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
for (const name of ["build", "start", "verify"]) {
  if (!pkg.scripts?.[name]) {
    console.error(`NPM SCRIPT MISSING: ${name}`);
    failed = true;
  }
}
try {
  const tsPath = execSync("node -e \"console.log(require.resolve('typescript'))\"", { encoding: "utf8" }).trim();
  const ts = await import(tsPath);
  let parseErrors = 0;
  for (const file of tsFiles) {
    const source = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    if (sf.parseDiagnostics?.length) {
      console.error(`PARSE ERROR: ${path.relative(root, file)}`);
      parseErrors += sf.parseDiagnostics.length;
    }
  }
  console.log(`Parser check: ${tsFiles.length} TS/TSX files, ${parseErrors} syntax errors`);
  if (parseErrors) failed = true;
} catch (error) {
  console.warn("Parser check skipped:", error?.message || error);
}
if (failed) process.exit(1);
console.log("Licia verification passed.");
