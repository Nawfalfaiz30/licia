import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const must = [
  "components/layout/nav-items.ts",
  "components/layout/BottomNav.tsx",
  "components/layout/MoreSheet.tsx",
  "components/chat/ChatWidget.tsx",
  "app/(app)/tasks/page.tsx",
  "app/(app)/finance/page.tsx",
  "app/(app)/knowledge/page.tsx",
  "app/(app)/wellbeing/page.tsx",
  "app/(app)/settings/page.tsx",
  "app/(app)/guide/page.tsx",
];
for (const file of must) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);

const nav = fs.readFileSync(path.join(root, "components/layout/nav-items.ts"), "utf8");
for (const token of ["/goals-projects", "/knowledge", "/finance", "/wellbeing"]) {
  if (!nav.includes(token)) throw new Error(`Navigation missing ${token}`);
}
for (const legacy of ['item("/goals"', 'item("/projects"', 'item("/health"', 'item("/habits"', 'item("/learning"']) {
  if (nav.includes(legacy)) throw new Error(`Legacy duplicate still exposed: ${legacy}`);
}

const chat = fs.readFileSync(path.join(root, "components/chat/ChatWidget.tsx"), "utf8");
if (chat.includes("Ringkasan aksi") && chat.includes("<p"))
  throw new Error("Chat still renders the old large action summary");
if (!chat.includes("chat-refined")) throw new Error("Refined chat layout missing");

const tasks = fs.readFileSync(path.join(root, "app/(app)/tasks/page.tsx"), "utf8");
for (const token of ["/api/v38/daily-plan?refresh=1", "Agenda → Tugas", "Tugas → Agenda", "Susun dengan Licia"]) {
  if (!tasks.includes(token)) throw new Error(`Task action missing ${token}`);
}
if (/href="\/chat\?prompt=.*prior/i.test(tasks)) throw new Error("Priority task flow still bridges to Chat");

const finance = fs.readFileSync(path.join(root, "app/(app)/finance/page.tsx"), "utf8");
for (const token of ["Langganan aktif", 'setTab("subscriptions")', "monthly", "weekly"])
  if (!finance.includes(token)) throw new Error(`Finance subscription support missing ${token}`);

const guide = fs.readFileSync(path.join(root, "app/(app)/guide/page.tsx"), "utf8");
for (const token of ["Lainnya di ponsel", "Knowledge & Belajar", "Kesehatan & Rutinitas", "Pengaturan"])
  if (!guide.includes(token)) throw new Error(`Guide missing ${token}`);
if (/V3[0-9]|V4[0-9]|versi V/i.test(guide)) throw new Error("Guide contains internal version wording");

const settings = fs.readFileSync(path.join(root, "app/(app)/settings/page.tsx"), "utf8");
for (const token of ["Target & Proyek", "Knowledge & Belajar", "Keuangan", "Kesehatan"])
  if (!settings.includes(token)) throw new Error(`Settings privacy grouping missing ${token}`);
if (/V3[0-9]|V4[0-9]|versi V/i.test(settings)) throw new Error("Settings contains internal version wording");

console.log("Licia consolidated UX regression tests OK — all checks passed");
