import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const nav = read("components/layout/nav-items.ts"),
  mainNav = nav.split("export const moreNavGroups")[0],
  more = read("components/layout/MoreSheet.tsx"),
  guide = read("app/(app)/guide/page.tsx"),
  settings = read("app/(app)/settings/page.tsx"),
  tasks = read("app/(app)/tasks/page.tsx"),
  finance = read("app/(app)/finance/page.tsx"),
  chat = read("components/chat/ChatWidget.tsx");
for (const token of ['/goals"', '/projects"', '/health"', '/habits"', '/learning"'])
  if (nav.includes(token)) throw new Error(`Legacy/unmerged menu still exposed: ${token}`);
if (mainNav.includes('item("/automations"')) throw new Error("Automations should not be a desktop top-level menu");
if (!more.includes("Cari fitur") || !more.includes("Lainnya"))
  throw new Error("Mobile Lainnya is not searchable/visible");
if (
  !chat.includes("MAX_DISPLAY_MESSAGES = 18") ||
  !chat.includes(`showAvatar={message.role === "user"`) ||
  !chat.includes("Ada perubahan siap diterapkan")
)
  throw new Error("Chat refinement missing");
if (!tasks.includes(`mutateEntity({ entityType: "task", operation: "update"`))
  throw new Error("Priority action is not direct");
if (!finance.includes("Komitmen berikutnya")) throw new Error("Finance overview missing");
if (/V\d+/i.test(guide) || /versi\s+v/i.test(guide)) throw new Error("Guide version wording found");
if (/V\d+/i.test(settings) || /versi\s+v/i.test(settings)) throw new Error("Settings version wording found");
console.log("Licia workspace consolidation verify OK");
