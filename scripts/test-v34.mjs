import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

const pkg = JSON.parse(read("package.json"));
if (!/^0\.3[45]\.0$/.test(pkg.version)) failures.push("package version is not V34/V35");
if (!read("app/api/sync/mutation/route.ts").includes("TARGET_NOT_FOUND")) failures.push("mutation target failure is not recorded");
if (!read("app/api/sync/mutation/route.ts").includes("getServerChangedFields")) failures.push("smart conflict history lookup missing");
if (!read("app/api/sync/mutation/route.ts").includes("smartMerge")) failures.push("smart merge telemetry missing");
if (!read("lib/sync/conflict.ts").includes("serverChangedFields")) failures.push("field-aware conflict merge missing");
if (!read("supabase/schema_v34_sync_robustness.sql").includes("alter table public.life_os_sync_events")) failures.push("V34 sync event schema missing");
if (!read("supabase/schema_v34_sync_robustness.sql").includes("changed_fields text[]")) failures.push("changed_fields column missing");
if (!read("components/SyncManager.tsx").includes("appVersion: \"0.35.0\"")) failures.push("device app version not bumped");
if (!read("public/sw.js").includes("licia-v35-pwa-r1")) failures.push("V34 PWA cache missing");
if (!read("app/(app)/settings/page.tsx").includes("Strategi konflik")) failures.push("sync settings missing");
if (!read("app/(app)/settings/page.tsx").includes("Gaya animasi")) failures.push("motion settings missing");
if (!read("components/chat/ChatWidget.tsx").includes("enterKeyHint={enterToSend ? \"send\" : \"enter\"}")) failures.push("chat enter hint missing");
if (!read("components/GlobalQuickCapture.tsx").includes("Ctrl/Cmd + Enter")) failures.push("quick capture keyboard hint missing");
if (!read("components/capture/VoiceCaptureButton.tsx").includes("SpeechRecognition")) failures.push("voice capture missing");
if (!read("components/intelligence/ProactiveInsight.tsx").includes("Licia menyarankan")) failures.push("proactive insight copy missing");
if (fs.existsSync(path.join(root, ".env.local"))) failures.push(".env.local must never ship in release archive");

if (failures.length) {
  console.error(`Licia V34 tests FAILED (${failures.length})`);
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log("Licia V34 tests passed.");
