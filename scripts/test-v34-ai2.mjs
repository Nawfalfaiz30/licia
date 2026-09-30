import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mustContain = [
  ["lib/ai/tools.ts", "delete_all_notifications"],
  ["lib/ai/tools.ts", "get_notifications"],
  ["lib/ai/tools.ts", "mark_notification_read"],
  ["lib/ai/toolRouting.ts", "notifications:"],
  ["app/api/ai/batch/route.ts", "status: \"applied\""],
  ["app/api/ai/batch/route.ts", "execution_result"],
  ["app/api/notifications/route.ts", "export async function DELETE"],
  ["app/api/push/test/route.ts", "NO_PUSH_SUBSCRIPTION"],
  ["lib/notifications/push.ts", "workerReady"],
  ["lib/notifications/client.ts", "Subscription perangkat cukup"],
  ["supabase/schema_v34_1_ai_execution.sql", "completed_actions"],
  ["app/(app)/guide/page.tsx", "AI & CRUD Life OS"],
];
for (const [file, token] of mustContain) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error(`File tidak ditemukan: ${file}`);
  const text = fs.readFileSync(full, "utf8");
  if (!text.includes(token)) throw new Error(`Token belum ditemukan: ${file} :: ${token}`);
}
const batch = fs.readFileSync(path.join(root, "app/api/ai/batch/route.ts"), "utf8");
if (batch.includes('status: failed ? "applied_with_errors" : "applied"')) throw new Error("Batch masih memakai transisi applied_with_errors yang bermasalah.");
console.log("Licia V34 AI Upgrade 2 tests passed.");
