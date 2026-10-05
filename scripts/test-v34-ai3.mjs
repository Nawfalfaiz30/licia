import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const chat = read("app/api/chat/route.ts");
const batch = read("app/api/ai/batch/route.ts");
const tools = read("lib/ai/tools.ts");
const pushClient = read("lib/notifications/client.ts");
const pushTest = read("app/api/push/test/route.ts");
const guide = read("app/(app)/guide/page.tsx");
const pkg = JSON.parse(read("package.json"));

function must(condition, message) {
  if (!condition) throw new Error(`V34 AI3 test failed: ${message}`);
}

must(chat.includes("selectReadToolDefs(toolDefs)"), "aiReadAllData must expose all read tools without write-only fallback routing");
must(chat.includes("selectReadToolDefs"), "read-only universal tool selector must be imported");
must(chat.includes('delete_all_notifications memiliki konfirmasi eksplisit'), "notification mass-delete confirmation path missing");
must(!chat.includes('["log_expenses_batch", "delete_tasks_bulk", "delete_all_notifications"]'), "delete_all_notifications must not be routed through pending batch replay");
must(chat.includes("KHUSUS JADWAL"), "vision schedule extraction guidance missing");
must(tools.includes('name: "get_notifications"'), "get_notifications tool missing");
must(tools.includes('name: "delete_notification"'), "delete_notification tool missing");
must(tools.includes('name: "delete_all_notifications"'), "delete_all_notifications tool missing");
must(tools.includes('name: "mark_notification_read"'), "mark_notification_read tool missing");
must(batch.includes('status: "applied"'), "batch must finish with applied for legacy DB trigger compatibility");
must(batch.includes("execution_result"), "batch execution metadata missing");
must(pushClient.includes("vapid?.vapidConfigured") && pushClient.includes("publicKey"), "device push subscription must not depend on service-role/cron readiness");
must(pushTest.includes('PUSH_SERVER_NOT_READY'), "push test must expose actionable configuration code");
must(pushTest.includes('NO_PUSH_SUBSCRIPTION'), "push test must distinguish missing subscription");
must(pushTest.includes('PUSH_DELIVERY_FAILED'), "push test must distinguish delivery failure");
must(guide.includes('Checklist pemeriksaan V34'), "complete V34 guide checklist missing");
must(guide.includes('Saat AI gagal menjalankan aksi'), "AI troubleshooting guide missing");
must(guide.includes('Build & deployment'), "deployment guide missing");
must(pkg.scripts?.["test:v34-ai2"] === "node scripts/test-v34-ai2.mjs", "AI2 test script must stay registered");

console.log("Licia V34 AI Upgrade 3 tests passed.");
