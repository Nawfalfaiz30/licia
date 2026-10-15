import { spawnSync } from "node:child_process";

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

const supported = /\.(?:[cm]?js|jsx|[cm]?ts|tsx|css|scss|json|md|mdx|ya?ml|html|sql)$/i;
const generatedPath = /(?:^|\/)(?:node_modules|\.next|coverage|work)(?:\/|$)/i;
// Preserve the legacy dashboard's existing layout; formatting that file adds over 1,200 lines of unrelated churn.
const legacyUnformatted = new Set(["app/(app)/dashboard/page.tsx"]);
let base = process.env.FORMAT_BASE_SHA?.trim();
if (!base || !/^[0-9a-f]{40}$/i.test(base) || /^0+$/.test(base)) {
  const mergeBase = git(["merge-base", "HEAD", "origin/main"]);
  base = mergeBase?.[0];
}

let files = base ? git(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]) : null;
if (files == null) files = git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]);
const workingTree = git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]) || [];
const untracked = git(["ls-files", "--others", "--exclude-standard"]) || [];
files = [...new Set([...(files || []), ...workingTree, ...untracked])].filter(
  (file) => supported.test(file) && !generatedPath.test(file.replaceAll("\\", "/")),
);
const skipped = files.filter((file) => legacyUnformatted.has(file.replaceAll("\\", "/")));
files = files.filter((file) => !legacyUnformatted.has(file.replaceAll("\\", "/")));
if (skipped.length) console.log(`Preserving existing formatting in legacy file(s): ${skipped.join(", ")}`);

if (!files.length) {
  console.log("Changed-file formatting check skipped: no supported changed files.");
  process.exit(0);
}

const result = spawnSync(process.execPath, ["node_modules/prettier/bin/prettier.cjs", "--check", ...files], {
  stdio: "inherit",
  windowsHide: true,
});
process.exit(result.status ?? 1);
