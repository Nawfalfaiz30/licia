import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [
  ["V37 plan workspace", "app/(app)/plan/page.tsx", /PlanWorkspace/],
  ["V37 knowledge workspace", "app/(app)/knowledge/page.tsx", /Knowledge/],
  ["V37 goals/projects workspace", "app/(app)/goals-projects/page.tsx", /Target & Proyek/],
  ["V37 consolidated navigation", "components/layout/nav-items.ts", /item\("\/plan"/],
  ["V37 reduced settings", "app/(app)/settings/page.tsx", /Kemampuan internal Licia tetap lengkap/],
  ["V37 temporal guard", "lib/v36/temporal.ts", /tanggal 26 berikutnya/],
  ["V37 AI smart context", "app/api/chat/route.ts", /aiContextMode === "all"/],
  ["V37 AI privacy guard", "app/api/chat/route.ts", /deniedToolNames/],
  ["V37 AI tool routing helper", "lib/ai/toolRouting.ts", /getDomainToolNames/],
  ["V37 agenda completion migration", "supabase/schema_v37_unified_workspaces.sql", /completed_at/],
];
let failed = 0;
for (const [label, file, pattern] of checks) {
  const full = path.join(root, file);
  if (!fs.existsSync(full) || !pattern.test(fs.readFileSync(full, "utf8"))) {
    console.error(`FAIL  ${label}`);
    failed += 1;
  } else console.log(`PASS  ${label}`);
}

const nav = fs.readFileSync(path.join(root, "components/layout/nav-items.ts"), "utf8");
for (const route of ["/dashboard", "/plan", "/chat", "/capture", "/insights"]) {
  if (!nav.includes(`item("${route}"`)) {
    console.error(`FAIL  primary route ${route}`);
    failed += 1;
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.version !== "0.37.0") {
  console.error("FAIL  package version is not 0.37.0");
  failed += 1;
} else console.log("PASS  package version 0.37.0");

if (failed) process.exit(1);
console.log("V37 verification complete.");
