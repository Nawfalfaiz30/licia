import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const nav = read("components/layout/nav-items.ts");
const chat = read("components/chat/ChatWidget.tsx");
const tasks = read("app/(app)/tasks/page.tsx");
const dashboard = read("app/(app)/dashboard/page.tsx");
const guide = read("app/(app)/guide/page.tsx");
const settings = read("app/(app)/settings/page.tsx");
const notification = read("components/intelligence/NotificationCenter.tsx");
const finance = read("app/(app)/finance/page.tsx");

function assert(condition, message) {
  if (!condition) throw new Error(`V48 regression: ${message}`);
}

assert(
  nav.includes('"Target & Proyek"') && !nav.includes('item("/goals", "Target"'),
  "Target canonical workspace missing or legacy target menu resurfaced",
);
assert(
  nav.includes("Lainnya") || read("components/layout/BottomNav.tsx").includes("Lainnya"),
  "Mobile footer must expose Lainnya",
);
assert(nav.includes('"Keuangan"') && nav.includes('"Kalender & Pengingat"'), "Canonical mobile navigation missing");
assert(chat.includes("chat-v48"), "Chat must use the consolidated visual surface");
assert(chat.includes("chat-v48-inline-action"), "Chat action summary must be inline, not a separate stacked footer");
assert(
  tasks.includes("async function runPriorityPlan()") &&
    tasks.includes("async function convertAgendaToTasks()") &&
    tasks.includes("async function scheduleOpenTasks("),
  "Task actions must execute directly from the Tasks workspace",
);
assert(tasks.includes("priorityPlan?.focus"), "Priority plan UI must remain null-safe before rendering the focus text");
assert(!tasks.includes('href="/chat"'), "Task workspace contains a Chat redirect");
assert(
  dashboard.includes('.eq("block_date", today)') && dashboard.includes('.gt("block_date", today)'),
  "Dashboard must separate today's schedule from upcoming schedule",
);
assert(
  notification.includes("bg-surface") || notification.includes("var(--surface)"),
  "Notification panel lacks an opaque surface",
);
assert(
  finance.includes("Kelola langganan") && finance.includes('tab==="subscriptions"'),
  "Finance must surface subscriptions inside the finance workspace",
);
for (const [name, source] of [
  ["guide", guide],
  ["settings", settings],
]) {
  assert(
    !/Pengaturan\s+V\d|AI\s+agent\s+V\d|V3[0-9]\b|V4[0-9]\b/i.test(source),
    `${name} contains a versioned user-facing label`,
  );
}
console.log("Licia V48 regression tests OK — all checks passed");
