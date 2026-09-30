import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "components/layout/nav-items.ts",
  "components/layout/BottomNav.tsx",
  "components/layout/MoreSheet.tsx",
  "components/chat/ChatWidget.tsx",
  "app/(app)/guide/page.tsx",
  "app/(app)/settings/page.tsx",
  "app/globals.css",
  "scripts/test-v40.mjs",
];
const errors = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing: ${file}`);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== "0.40.0") errors.push(`package version is ${pkg.version}`);
if (pkg.scripts.test !== "node scripts/test-v40.mjs") errors.push("npm test is not wired to V40");
if (pkg.scripts.verify !== "node scripts/verify-v40.mjs") errors.push("npm run verify is not wired to V40");
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
if (lock.version !== "0.40.0" || lock.packages?.[""]?.version !== "0.40.0") errors.push("package-lock is not aligned with V40");
const nav = fs.readFileSync(path.join(root, "components/layout/nav-items.ts"), "utf8");
if (nav.includes('item("/goals", "Target"') || nav.includes('item("/projects", "Proyek"')) errors.push("duplicate target/project nav remains");
const guide = fs.readFileSync(path.join(root, "app/(app)/guide/page.tsx"), "utf8");
if (/title:\"[^\"]*\bV\d/.test(guide)) errors.push("guide contains a versioned title");
const settings = fs.readFileSync(path.join(root, "app/(app)/settings/page.tsx"), "utf8");
if (/Pengaturan V\d/i.test(settings)) errors.push("settings contains a version label");
if (errors.length) {
  console.error("V40 VERIFY FAILED");
  errors.forEach((e) => console.error("-", e));
  process.exit(1);
}
console.log("Licia V40 verify OK — consolidated navigation/chat/guide/settings checked");
