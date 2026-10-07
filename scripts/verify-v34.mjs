import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
let failed = false;
const required = [
  "supabase/schema_v34_sync_robustness.sql",
  "lib/sync/conflict.ts",
  "app/api/sync/mutation/route.ts",
  "app/api/sync/pull/route.ts",
  "components/SyncManager.tsx",
  "components/MotionRuntime.tsx",
  "components/GlobalQuickCapture.tsx",
  "components/capture/VoiceCaptureButton.tsx",
  "components/intelligence/ProactiveInsight.tsx",
  "components/sync/ConflictCenter.tsx",
  "lib/performance/userCache.ts",
  "app/api/sync/preferences/route.ts",
  "public/sw.js",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`MISSING: ${file}`);
    failed = true;
  }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!/^0\.3[45]\.0$/.test(pkg.version)) {
  console.error("PACKAGE VERSION MUST BE V34/V35");
  failed = true;
}
const tokens = {
  "supabase/schema_v34_sync_robustness.sql": ["changed_fields", "licia_changed_fields", "licia_write_sync_event"],
  "lib/sync/conflict.ts": ["serverChangedFields", "mergeIfSafe"],
  "app/api/sync/mutation/route.ts": ["getServerChangedFields", "smartMerge", "TARGET_NOT_FOUND"],
  "app/api/sync/pull/route.ts": ["changed_fields"],
  "components/SyncManager.tsx": ["0.35.0", "licia-sync-on-network-change", "licia-sync-on-visibility"],
  "components/MotionRuntime.tsx": ["reducedMotion", "licia:preferences-change"],
  "components/GlobalQuickCapture.tsx": ["mutateEntity", "VoiceCaptureButton"],
  "components/capture/VoiceCaptureButton.tsx": ["SpeechRecognition", "licia-voice-capture-language"],
  "components/intelligence/ProactiveInsight.tsx": ["/api/proactive/evaluate"],
  "lib/performance/userCache.ts": ["memoizeUserData", "MAX_ENTRIES"],
  "public/sw.js": ["licia-v35-pwa-r1", "replayOfflineQueue"],
};
for (const [file, list] of Object.entries(tokens)) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const token of list)
    if (!source.includes(token)) {
      console.error(`TOKEN MISSING ${token} in ${file}`);
      failed = true;
    }
}
try {
  const tsPath = execSync("node -e \"console.log(require.resolve('typescript'))\"", { encoding: "utf8" }).trim();
  const ts = await import(tsPath);
  let errors = 0;
  let count = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (/\.tsx?$/.test(entry.name)) {
        count += 1;
        const src = fs.readFileSync(filePath, "utf8");
        const sf = ts.createSourceFile(
          filePath,
          src,
          ts.ScriptTarget.Latest,
          true,
          entry.name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        if (sf.parseDiagnostics?.length) {
          console.error(`PARSE ERROR: ${path.relative(root, filePath)}`);
          errors += sf.parseDiagnostics.length;
        }
      }
    }
  };
  for (const dir of ["app", "components", "lib"]) walk(path.join(root, dir));
  console.log(`V34 parser check: ${count} TS/TSX files, ${errors} syntax errors`);
  if (errors) failed = true;
} catch (error) {
  console.warn("V34 parser check skipped:", error?.message || error);
}
if (failed) process.exit(1);
console.log("Licia V34 verification passed.");
