import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const pkg = JSON.parse(read("package.json"));
if (pkg.version !== "0.33.0") failures.push("package version is not V33 (0.33.0)");
if (!String(pkg.dependencies?.next || "").startsWith("16.")) failures.push("Next.js 16 dependency missing");
if (!fs.existsSync(path.join(root, "proxy.ts"))) failures.push("proxy.ts missing");
if (fs.existsSync(path.join(root, "middleware.ts"))) failures.push("legacy middleware.ts still exists");
if (!read("lib/supabase/server.ts").includes("await cookies()"))
  failures.push("Supabase server client is not using async cookies()");
if (!read("lib/notifications/events.ts").includes("event && !event.delivered_at"))
  failures.push("notification dedupe guard missing");
if (!read("app/api/reminders/dispatch/route.ts").includes("system_health_heartbeats"))
  failures.push("reminder dispatch heartbeat missing");
if (!read("app/api/system/diagnostics/route.ts").includes("orphanedReminders"))
  failures.push("system diagnostics orphan detection missing");
if (!read("lib/ai/contextEngine.ts").includes("focusCandidates")) failures.push("context engine missing");
if (!read("lib/ai/modelRouter.ts").includes("LICIA_AI_HEAVY_MODEL")) failures.push("AI model router missing");
if (!read("lib/ai/usage.ts").includes("ai_usage_events")) failures.push("AI usage telemetry missing");
if (!read("app/api/intelligence/context/route.ts").includes("buildActionableContext"))
  failures.push("context API missing");
if (!read("supabase/schema_v30_core_intelligence.sql").includes("ai_usage_events"))
  failures.push("AI usage schema missing");
if (!read("supabase/schema_v30_core_intelligence.sql").includes("trg_licia_task_delete_cancel_reminders"))
  failures.push("task reminder trigger missing");
if (!read("supabase/schema_v30_core_intelligence.sql").includes("uniq_reminders_one_active_bound_target_offset"))
  failures.push("reminder uniqueness index missing");
if (!read("supabase/schema_v31_sync.sql").includes("life_os_sync_devices"))
  failures.push("V31 device registry schema missing");
if (!read("supabase/schema_v31_sync.sql").includes("life_os_sync_events"))
  failures.push("V31 sync event schema missing");
if (!read("supabase/schema_v31_sync.sql").includes("life_os_sync_mutations"))
  failures.push("V31 mutation idempotency schema missing");
if (!read("supabase/schema_v32_sync_experience.sql").includes("life_os_sync_conflicts"))
  failures.push("V33 conflict schema missing");
if (!read("components/sync/ConflictCenter.tsx").includes("Pakai perangkat"))
  failures.push("V33 conflict center missing");
if (!read("lib/ai/contextCache.ts").includes("memoizeUserContext")) failures.push("V33 context cache missing");
if (!read("components/chat/ChatWidget.tsx").includes("Ctrl/Cmd+Enter kirim"))
  failures.push("Chat Enter-to-send fallback hint missing");
if (!read("lib/notifications/push.ts").includes("LICIA_CRON_SECRET"))
  failures.push("Web Push cron configuration guard missing");
if (!read("public/sw.js").includes("licia-v33-pwa-r4")) failures.push("V33 service worker cache version missing");
if (!read("lib/sync/client.ts").includes("mutateEntity")) failures.push("Universal sync mutation client missing");
if (!read("components/layout/SyncStatusBadge.tsx").includes("Pusat Sinkronisasi"))
  failures.push("Sync status badge missing");
if (!read("components/intelligence/ProactiveInsight.tsx").includes("/api/proactive/evaluate"))
  failures.push("Proactive insight UI missing");
if (!read("app/api/proactive/evaluate/route.ts").includes("proactiveAssistant"))
  failures.push("Proactive evaluation endpoint missing");
if (!read("components/ui/AnimatedNumber.tsx").includes("requestAnimationFrame"))
  failures.push("Animated number component missing");
if (!read("app/(app)/settings/page.tsx").includes("Ruang kerja & nilai bawaan"))
  failures.push("Settings language polish missing");

if (!read("supabase/schema_v33_life_os.sql").includes("life_os_entity_links"))
  failures.push("V33 entity links schema missing");
if (!read("components/MotionRuntime.tsx").includes("reducedMotion")) failures.push("V33 motion runtime missing");
if (!read("components/capture/VoiceCaptureButton.tsx").includes("SpeechRecognition"))
  failures.push("V33 voice capture missing");
if (!read("app/(app)/sync/page.tsx").includes("PUSAT SINKRONISASI")) failures.push("V33 sync center missing");
if (!read("app/api/sync/pull/route.ts").includes("resyncRequired")) failures.push("V33 resync handling missing");
if (!read("components/SyncManager.tsx").includes("licia-sync-on-network-change"))
  failures.push("V33 network sync preference wiring missing");
if (!read("components/SyncManager.tsx").includes("licia-sync-on-visibility"))
  failures.push("V33 visibility sync preference wiring missing");
if (!read("app/(app)/settings/page.tsx").includes("Bahasa tangkap suara")) failures.push("V33 voice settings missing");
if (!read("app/api/intelligence/daily-snapshot/route.ts").includes("life_os_daily_snapshots"))
  failures.push("V33 daily snapshot route missing");

if (failures.length) {
  console.error(`Licia V33 smoke tests FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Licia V33 smoke tests passed.");
