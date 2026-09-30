import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const tools = read("lib/ai/tools.ts");
const routeChat = read("app/api/chat/route.ts");
const routes = ["app/api/v35/brain/route.ts","app/api/v35/what-if/route.ts","app/api/v35/watchers/route.ts","app/api/v35/insights/route.ts"].map(read).join("\n");
const checks = [
  ["AI full CRUD surface", /manage_life_os_data/.test(tools)],
  ["Notification CRUD", /delete_all_notifications/.test(tools)],
  ["Task dependencies", /get_task_dependencies/.test(tools) && /create_task_dependency/.test(tools)],
  ["Daily brain", /getDailyBrain/.test(tools)],
  ["Agent policy", fs.existsSync(path.join(root,"lib/v35/agent.ts"))],
  ["Post-action verification", fs.existsSync(path.join(root,"lib/v35/verify.ts"))],
  ["What-if route", /simulationOnly/.test(routes)],
  ["Watcher route", /ai_watchers/.test(routes)],
  ["Insights route", /health_metrics/.test(routes) && /subscriptions/.test(routes)],
  ["Motion system", /licia-v35-ambient/.test(read("app/globals.css"))],
  ["Offline queue center", fs.existsSync(path.join(root,"components/v35/QueueCenter.tsx"))],
  ["Push actions", /actions\?: Array/.test(read("lib/notifications/push.ts"))],
  ["Schedule vision draft", /pendingScheduleImport/.test(routeChat) && /analyzeScheduleImageStructured/.test(routeChat)],
  ["Deterministic schedule range", /buildScheduleDateMapForRange/.test(routeChat)],
  ["Date guard ignores vision prose", /hasConcreteScheduleDate/.test(routeChat) && /String\(message \|\| ""\)/.test(routeChat)],
  ["Calendar weekday/date validation", /sourceWeekday/.test(tools)],
];
let ok = true;
for (const [label, pass] of checks) { console.log(`${pass ? "PASS" : "FAIL"} ${label}`); if (!pass) ok = false; }
if (!ok) process.exit(1);
console.log("V35 tests passed");

