import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const nav = read("components/layout/nav-items.ts");
const settings = read("app/(app)/settings/page.tsx");
const guide = read("app/(app)/guide/page.tsx");
const chat = read("components/chat/ChatWidget.tsx");
const tasks = read("app/(app)/tasks/page.tsx");
const finance = read("app/(app)/finance/page.tsx");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));

assert(pkg.version === "0.45.0", "package.json version mismatch");
assert(lock.version === "0.45.0", "package-lock root version mismatch");
assert(nav.includes('group("Workspace utama", "nav_workspace_main"'), "workspace main group missing");
assert(nav.includes('item("/insights#life-map", "Peta & Relasi"'), "Peta & Relasi shortcut missing");
assert(nav.includes('item("/insights#analytics", "Review & Pola"'), "Review & Pola shortcut missing");
assert(nav.includes('item("/finance", "Keuangan"'), "canonical Finance workspace missing");
assert(
  !nav.includes('"subscriptions"') && !nav.includes('"memory"') && !nav.includes('"vault"'),
  "merged features reappeared in navigation",
);
assert(chat.includes("max-w-[92%] sm:max-w-[74%]"), "chat bubble width polish missing");
assert(tasks.includes('showActionResult({ title: "Prioritas dengan Licia"'), "priority action is direct");
assert(tasks.includes('showActionResult({ title: "Agenda → Tugas"'), "agenda-to-task action is direct");
assert(tasks.includes('showActionResult({ title: "Tugas → Agenda"'), "task-to-agenda action is direct");
assert(
  finance.includes("Komitmen rutin") && finance.includes("Catat pembayaran"),
  "finance recurring commitments integration incomplete",
);
assert(!/V\d{2}(?:\.\d+)?/i.test(guide), "Guide contains an internal version label");
assert(!/V\d{2}(?:\.\d+)?/i.test(settings), "Settings contains an internal version label");

console.log("Licia 0.45 verify OK");
