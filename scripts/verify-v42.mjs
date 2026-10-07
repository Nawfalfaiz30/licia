import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const text = (f) => fs.readFileSync(path.join(root, f), "utf8");
const nav = text("components/layout/nav-items.ts");
const guide = text("app/(app)/guide/page.tsx");
const settings = text("app/(app)/settings/page.tsx");
const chat = text("components/chat/ChatWidget.tsx");
const bad = ['/goals"', '/projects"', '/health"', '/habits"', '/learning"', '/ai-history"'];
for (const token of bad) if (nav.includes(token)) throw new Error(`Duplicate navigation exposed: ${token}`);
for (const source of [
  ["guide", guide],
  ["settings", settings],
])
  if (/V3[0-9]|V4[0-9]|versi V/i.test(source[1])) throw new Error(`${source[0]} contains internal version labels`);
if (!chat.includes("chat-refined")) throw new Error("Chat refinement missing");
if (!fs.existsSync(path.join(root, "app/(app)/wellbeing/page.tsx"))) throw new Error("Wellbeing hub missing");
console.log("Licia consolidated UX verify OK");
