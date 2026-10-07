import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/(app)/today/page.tsx",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/goals-projects/page.tsx",
  "app/(app)/goals/page.tsx",
  "app/(app)/projects/page.tsx",
  "components/intelligence/NotificationCenter.tsx",
  "components/layout/nav-items.ts",
  "scripts/test-v39.mjs",
];
const errors = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing: ${file}`);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== "0.39.0") errors.push(`package version is ${pkg.version}`);
if (pkg.scripts.test !== "node scripts/test-v39.mjs") errors.push("npm test is not wired to V39");
if (pkg.scripts.verify !== "node scripts/verify-v39.mjs") errors.push("npm run verify is not wired to V39");
const nav = fs.readFileSync(path.join(root, "components/layout/nav-items.ts"), "utf8");
if (!nav.includes('item("/goals-projects", "Target & Proyek"')) errors.push("unified target/project nav missing");
if (nav.includes('item("/goals", "Target"')) errors.push("legacy target nav still visible");
if (nav.includes('item("/projects", "Proyek"')) errors.push("legacy project nav still visible");
if (errors.length) {
  console.error("V39 VERIFY FAILED");
  errors.forEach((e) => console.error("-", e));
  process.exit(1);
}
console.log("Licia V39 verify OK — unified dashboard/agenda/target-project/notification upgrade checked");
