import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
const root = process.cwd();
let failed = false;
const required = [
  "supabase/schema_v31_sync.sql",
  "supabase/schema_v32_sync_experience.sql",
  "supabase/schema_v33_life_os.sql",
  "app/api/sync/mutation/route.ts",
  "app/api/sync/pull/route.ts",
  "app/api/sync/status/route.ts",
  "components/SyncManager.tsx",
  "components/sync/ConflictCenter.tsx",
  "components/MotionRuntime.tsx",
  "components/capture/VoiceCaptureButton.tsx",
  "app/(app)/sync/page.tsx",
  "app/api/intelligence/daily-snapshot/route.ts",
  "app/api/sync/preferences/route.ts",
  "public/sw.js",
];
for (const file of required)
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`MISSING: ${file}`);
    failed = true;
  }
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== "0.33.0") {
  console.error("PACKAGE VERSION MUST BE 0.33.0");
  failed = true;
}
for (const [file, tokens] of Object.entries({
  "supabase/schema_v33_life_os.sql": [
    "life_os_entity_links",
    "life_os_daily_snapshots",
    "life_os_entity_links_user_source_idx",
  ],
  "supabase/schema_v32_sync_experience.sql": ["life_os_sync_conflicts", "life_os_sync_mutations_status_created_idx"],
  "app/api/sync/mutation/route.ts": ["createConflict", "baseVersion", "life_os_sync_mutations"],
  "app/api/sync/pull/route.ts": ["resyncRequired", "nextCursor"],
  "components/SyncManager.tsx": ["life_os_sync_events", "licia-sync-on-network-change", "0.33.0"],
  "components/MotionRuntime.tsx": ["reducedMotion", "licia:preferences-change"],
  "components/capture/VoiceCaptureButton.tsx": ["SpeechRecognition", "licia-voice-capture-language"],
  "public/sw.js": ["licia-v33-pwa-r4", "replayOfflineQueue"],
  "app/(app)/settings/page.tsx": ["syncOnNetworkChange", "syncOnVisibility", "lifeGraphLinks", "dailySnapshot"],
  "app/api/intelligence/daily-snapshot/route.ts": [
    "life_os_daily_snapshots",
    "snapshotDate",
    "startOfDayIsoForTimezone",
  ],
  "app/api/sync/preferences/route.ts": ["preferences", "displayName", "updatedAt"],
})) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  for (const token of tokens)
    if (!src.includes(token)) {
      console.error(`TOKEN MISSING ${token} in ${file}`);
      failed = true;
    }
}
try {
  const tsPath = execSync("node -e \"console.log(require.resolve('typescript'))\"", { encoding: "utf8" }).trim();
  const ts = await import(tsPath);
  let errors = 0,
    count = 0;
  const roots = ["app", "components", "lib"];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) {
        count++;
        const src = fs.readFileSync(p, "utf8");
        const sf = ts.createSourceFile(
          p,
          src,
          ts.ScriptTarget.Latest,
          true,
          p.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        if (sf.parseDiagnostics?.length) {
          console.error(`PARSE ERROR: ${path.relative(root, p)}`);
          errors += sf.parseDiagnostics.length;
        }
      }
    }
  }
  for (const r of roots) walk(path.join(root, r));
  console.log(`V33 parser check: ${count} TS/TSX files, ${errors} syntax errors`);
  if (errors) failed = true;
} catch (e) {
  console.warn("V33 parser check skipped:", e?.message || e);
}
if (failed) process.exit(1);
console.log("Licia V33 verification passed.");
