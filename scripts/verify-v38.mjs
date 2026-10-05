import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "lib/ai/temporalGuard.ts",
  "app/api/v38/daily-plan/route.ts",
  "app/api/v38/daily-review/route.ts",
  "app/api/v38/feedback/route.ts",
  "components/intelligence/DailyPlanPanel.tsx",
  "components/intelligence/EndOfDayReview.tsx",
  "supabase/schema_v38_ai_feedback.sql",
];
const errors = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing: ${file}`);
const checks = [
  ["chat temporal guard", "app/api/chat/route.ts", "buildTemporalGuard"],
  ["chat metadata", "app/api/chat/route.ts", "aiMeta"],
  ["chat temporal tool", "app/api/chat/route.ts", "resolve_calendar_date"],
  ["context cache", "lib/ai/context.ts", "connected:"],
  ["mobile insights", "components/layout/BottomNav.tsx", "href=\"/insights\""],
  ["daily plan workspace", "components/plan/PlanWorkspace.tsx", "DailyPlanPanel"],
  ["end of day review", "app/(app)/insights/page.tsx", "EndOfDayReview"],
];
for (const [label, file, needle] of checks) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (!text.includes(needle)) errors.push(`${label}: needle not found`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== "0.38.0") errors.push(`package version is ${pkg.version}`);
if (pkg.scripts.test !== "node scripts/test-v38.mjs") errors.push("npm test is not wired to V38");
if (pkg.scripts.verify !== "node scripts/verify-v38.mjs") errors.push("npm run verify is not wired to V38");
if (errors.length) { console.error("V38 VERIFY FAILED"); for (const error of errors) console.error("-", error); process.exit(1); }
console.log("Licia V38 verify OK —", required.length, "new upgrade artifacts checked");
