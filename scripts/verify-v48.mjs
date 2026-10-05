import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const mustExist=[
  "components/chat/ChatWidget.tsx",
  "components/layout/BottomNav.tsx",
  "components/layout/MoreSheet.tsx",
  "components/layout/nav-items.ts",
  "components/intelligence/NotificationCenter.tsx",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/tasks/page.tsx",
  "app/(app)/finance/page.tsx",
  "app/(app)/guide/page.tsx",
  "app/(app)/settings/page.tsx",
  "scripts/test-v48.mjs"
];
for (const p of mustExist) if(!fs.existsSync(path.join(root,p))) throw new Error(`Missing ${p}`);
const packageJson=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
if(packageJson.version!=="0.48.2") throw new Error(`Expected package 0.48.2, got ${packageJson.version}`);
console.log("Licia V48 verify OK");
