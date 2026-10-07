import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const files = [
  "components/layout/nav-items.ts",
  "components/layout/BottomNav.tsx",
  "components/layout/MoreSheet.tsx",
  "components/chat/ChatWidget.tsx",
  "app/(app)/tasks/page.tsx",
  "app/(app)/finance/page.tsx",
  "app/(app)/guide/page.tsx",
  "app/(app)/settings/page.tsx",
  "app/(app)/subscriptions/page.tsx",
  "app/(app)/goals/page.tsx",
  "app/(app)/projects/page.tsx",
  "app/(app)/notes/page.tsx",
  "app/(app)/memory/page.tsx",
  "app/(app)/vault/page.tsx",
  "app/(app)/reading/page.tsx",
  "app/(app)/life-map/page.tsx",
  "app/(app)/life-graph/page.tsx",
  "app/(app)/timeline/page.tsx",
  "app/(app)/analytics/page.tsx",
  "app/(app)/review-center/page.tsx",
  "app/(app)/brief/page.tsx",
  "app/(app)/copilot/page.tsx",
  "app/(app)/command/page.tsx",
];
for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
}
const nav = fs.readFileSync(path.join(root, "components/layout/nav-items.ts"), "utf8");
if (nav.includes('item("/subscriptions"') || nav.includes('item("/projects"') || nav.includes('item("/goals"'))
  throw new Error("Duplicate merged navigation detected");
for (const [file, target] of [
  ["subscriptions", "/finance?tab=subscriptions"],
  ["goals", "/goals-projects"],
  ["projects", "/goals-projects"],
  ["notes", "/knowledge"],
  ["memory", "/knowledge"],
  ["vault", "/knowledge"],
  ["reading", "/knowledge"],
  ["life-map", "/insights"],
  ["life-graph", "/insights"],
  ["timeline", "/insights"],
  ["analytics", "/insights"],
  ["review-center", "/insights"],
  ["brief", "/insights"],
  ["copilot", "/chat"],
  ["command", "/chat"],
]) {
  const source = fs.readFileSync(path.join(root, `app/(app)/${file}/page.tsx`), "utf8");
  if (!source.includes(`redirect("${target}")`)) throw new Error(`${file} redirect mismatch`);
}
console.log("Licia V41 verify OK");
