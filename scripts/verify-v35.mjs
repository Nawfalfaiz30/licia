import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = [
  "lib/v35/brain.ts","lib/v35/agent.ts","lib/v35/verify.ts","lib/v35/featureRegistry.ts",
  "supabase/schema_v35_ai_experience.sql","app/api/v35/brain/route.ts","app/api/v35/what-if/route.ts",
  "app/api/v35/watchers/route.ts","app/api/v35/insights/route.ts","components/v35/DailyBrainCard.tsx",
  "components/v35/LifeInsights.tsx","components/v35/ReviewPulse.tsx","components/v35/WhatIfPanel.tsx","components/v35/QueueCenter.tsx"
];
const missing = required.filter(f => !fs.existsSync(path.join(root, f)));
if (missing.length) { console.error("Missing:", missing.join(", ")); process.exit(1); }
const registry = fs.readFileSync(path.join(root, "lib/v35/featureRegistry.ts"), "utf8");
const count = (registry.match(/\{ id: "/g) || []).length;
console.log(`V35 verify: ${count} feature registrations`);
const schema = fs.readFileSync(path.join(root, "supabase/schema_v35_ai_experience.sql"), "utf8");
for (const token of ["ai_action_plans","ai_watchers","ai_what_if_runs","life_os_task_dependencies","confidence","expires_at"]) {
  if (!schema.includes(token)) { console.error(`Missing schema token: ${token}`); process.exit(1); }
}
console.log("V35 verification passed");
