import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const mustExist = [
  "lib/ai/conversationIntelligence.ts",
  "app/api/chat/route.ts",
  "lib/ai/toolRouting.ts",
  "lib/v35/verify.ts",
  "components/chat/ChatWidget.tsx",
  "scripts/test-v49.mjs",
];
for (const file of mustExist) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== "0.49.4") throw new Error(`Expected package 0.49.4, got ${pkg.version}`);
console.log("Licia V49 verify OK");
