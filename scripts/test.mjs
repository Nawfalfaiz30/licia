import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const pkg = JSON.parse(read("package.json"));
if (pkg.version !== "0.3.0") failures.push("package version is not V30 (0.3.0)");
if (!String(pkg.dependencies?.next || "").startsWith("16.")) failures.push("Next.js 16 dependency missing");
if (!fs.existsSync(path.join(root, "proxy.ts"))) failures.push("proxy.ts missing");
if (fs.existsSync(path.join(root, "middleware.ts"))) failures.push("legacy middleware.ts still exists");
if (!read("lib/supabase/server.ts").includes("await cookies()")) failures.push("Supabase server client is not using async cookies()");
if (!read("lib/notifications/events.ts").includes("event && !event.delivered_at")) failures.push("notification dedupe guard missing");
if (!read("app/api/reminders/dispatch/route.ts").includes("system_health_heartbeats")) failures.push("reminder dispatch heartbeat missing");
if (!read("app/api/system/diagnostics/route.ts").includes("orphanedReminders")) failures.push("system diagnostics orphan detection missing");
if (!read("lib/ai/contextEngine.ts").includes("focusCandidates")) failures.push("V30 context engine missing");
if (!read("lib/ai/modelRouter.ts").includes("LICIA_AI_HEAVY_MODEL")) failures.push("AI model router missing");
if (!read("lib/ai/usage.ts").includes("ai_usage_events")) failures.push("AI usage telemetry missing");
if (!read("app/api/intelligence/context/route.ts").includes("buildActionableContext")) failures.push("context API missing");
if (!read("supabase/schema_v30_core_intelligence.sql").includes("ai_usage_events")) failures.push("AI usage schema missing");
if (!read("supabase/schema_v30_core_intelligence.sql").includes("trg_licia_task_delete_cancel_reminders")) failures.push("V30 task reminder trigger missing");
if (!read("supabase/schema_v30_core_intelligence.sql").includes("uniq_reminders_one_active_bound_target_offset")) failures.push("V30 reminder uniqueness index missing");
if (!read("public/sw.js").includes("licia-v30-pwa-r1")) failures.push("V30 service worker cache version missing");

if (failures.length) {
  console.error(`Licia V30 smoke tests FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Licia V30 smoke tests passed.");
