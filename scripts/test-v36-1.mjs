import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [
  ["package version 0.36.2", () => JSON.parse(read("package.json")).version === "0.36.2"],
  [
    "push rebind checks current VAPID key",
    () =>
      /applicationServerKey/.test(read("lib/notifications/client.ts")) &&
      /forceRenew/.test(read("lib/notifications/client.ts")) &&
      /licia-push-vapid-public-key/.test(read("lib/notifications/client.ts")),
  ],
  [
    "push delivery marks invalid subscriptions repairable",
    () =>
      /repairable:\s*\[400,401,403,404,410\]/.test(read("app/api/push/test/route.ts")) ||
      /repairable:\s*\[400,\s*401,\s*403,\s*404,\s*410\]/.test(read("app/api/push/test/route.ts")),
  ],
  [
    "push server removes invalid subscriptions",
    () => /\[400, 401, 403, 404, 410\]\.includes/.test(read("lib/notifications/push.ts")),
  ],
  [
    "AI history DELETE API",
    () =>
      fs.existsSync(path.join(root, "app/api/ai/history/route.ts")) &&
      /export async function DELETE/.test(read("app/api/ai/history/route.ts")),
  ],
  [
    "AI history UI delete controls",
    () =>
      /removeAll\(\)/.test(read("app/(app)/ai-history/page.tsx")) &&
      /\/api\/ai\/history/.test(read("app/(app)/ai-history/page.tsx")),
  ],
  ["AI horizon guide", () => /3 cara memakai AI Licia/.test(read("components/v36/AIModeGuide.tsx"))],
  ["Life Copilot clarified", () => /Untuk sekarang/.test(read("components/v36/LifeCopilotCard.tsx"))],
  ["Weekly review clarified", () => /7 hari terakhir/.test(read("components/v36/WeeklyReviewCard.tsx"))],
  [
    "notification browser dedupe",
    () => /!item\.delivered_at/.test(read("components/intelligence/NotificationCenter.tsx")),
  ],
  [
    "notification panel fixed",
    () => /fixed right-4 top-\[calc\(4\.75rem/.test(read("components/intelligence/NotificationCenter.tsx")),
  ],
  [
    "toast moved below app chrome",
    () => /top-\[calc\(4\.75rem\+env\(safe-area-inset-top\)\)\]/.test(read("components/ui/toast.tsx")),
  ],
  ["finance intelligence", () => /Finance Intelligence/.test(read("app/(app)/finance/page.tsx"))],
  ["routine intelligence", () => /Routine Intelligence/.test(read("app/(app)/habits/page.tsx"))],
  ["review center includes horizon guide", () => /AIModeGuide/.test(read("app/(app)/review-center/page.tsx"))],
];
let failed = 0;
for (const [name, fn] of checks) {
  try {
    if (!fn()) throw new Error("check returned false");
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (failed) process.exit(1);
console.log(`V36.1 tests passed (${checks.length} checks)`);
