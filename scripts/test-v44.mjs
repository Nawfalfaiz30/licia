import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const text = (f) => fs.readFileSync(path.join(root, f), "utf8");
const required = [
  "components/layout/nav-items.ts",
  "components/layout/BottomNav.tsx",
  "components/layout/MoreSheet.tsx",
  "components/chat/ChatWidget.tsx",
  "app/(app)/tasks/page.tsx",
  "app/(app)/finance/page.tsx",
  "app/(app)/insights/page.tsx",
  "app/(app)/guide/page.tsx",
  "app/(app)/settings/page.tsx",
];
for (const f of required) if (!fs.existsSync(path.join(root, f))) throw new Error(`Missing ${f}`);
const nav = text("components/layout/nav-items.ts");
const mainNav = nav.split("export const moreNavGroups")[0];
for (const token of [
  "/dashboard",
  "/plan",
  "/chat",
  "/capture",
  "/insights",
  "/goals-projects",
  "/knowledge",
  "/finance",
  "/wellbeing",
])
  if (!nav.includes(token)) throw new Error(`Canonical nav missing ${token}`);
for (const token of ['item("/goals"', 'item("/projects"', 'item("/health"', 'item("/habits"', 'item("/learning"'])
  if (nav.includes(token)) throw new Error(`Legacy duplicate exposed: ${token}`);
if (mainNav.includes('item("/automations"')) throw new Error("Automations should not be a desktop top-level menu");
const more = text("components/layout/MoreSheet.tsx");
for (const token of ["Lainnya", "Cari fitur", "subfitur", "moreNavGroups"])
  if (!more.includes(token)) throw new Error(`Mobile MoreSheet feature missing ${token}`);
const chat = text("components/chat/ChatWidget.tsx");
for (const token of ["MAX_DISPLAY_MESSAGES = 18", "showAvatar = true", "chat-message-meta"])
  if (!chat.includes(token)) throw new Error(`Chat refinement missing ${token}`);
const tasks = text("app/(app)/tasks/page.tsx");
for (const token of [
  "/api/v38/daily-plan?refresh=1",
  `mutateEntity({ entityType: "task", operation: "update"`,
  "Agenda → Tugas",
  "Tugas → Agenda",
])
  if (!tasks.includes(token)) throw new Error(`Direct task action missing ${token}`);
if (/href=\"\/chat\?prompt=.*prior/i.test(tasks)) throw new Error("Task priority action redirects to Chat");
const finance = text("app/(app)/finance/page.tsx");
for (const token of ["Komitmen berikutnya", "Catat pembayaran", "Tambah langganan"])
  if (!finance.includes(token)) throw new Error(`Finance subscription integration missing ${token}`);
const insights = text("app/(app)/insights/page.tsx");
for (const token of ["Otomasi", "/automations"])
  if (!insights.includes(token)) throw new Error(`Insights automation subfeature missing ${token}`);
const guide = text("app/(app)/guide/page.tsx");
if (/V\d+/i.test(guide) || /versi\s+v/i.test(guide)) throw new Error("Guide contains internal version wording");
for (const token of ["Prioritas dengan Licia", "Agenda → Tugas", "Tugas → Agenda", "langganan", "Lainnya di ponsel"])
  if (!guide.toLowerCase().includes(token.toLowerCase())) throw new Error(`Guide behavior missing ${token}`);
if (
  !nav.includes("Peta Hidup") ||
  !nav.includes("Peta Koneksi") ||
  !nav.includes("Linimasa") ||
  !nav.includes("Analitik Pribadi")
)
  throw new Error("Insight subfeatures missing from mobile feature index");
const settings = text("app/(app)/settings/page.tsx");
if (/V\d+/i.test(settings) || /versi\s+v/i.test(settings))
  throw new Error("Settings contains internal version wording");
for (const token of [
  "normalizeStartPage",
  "Target & Proyek",
  "Knowledge & Belajar",
  "Keuangan",
  "Kesehatan & Rutinitas",
])
  if (!settings.includes(token)) throw new Error(`Settings compatibility missing ${token}`);
console.log("Licia workspace consolidation regression tests OK — all checks passed");
