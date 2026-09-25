import fs from "node:fs";
import path from "node:path";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let value = m[2].trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[m[1]] = value.replace(/\\n/g, "\n");
  }
}

loadEnv(path.resolve(process.cwd(), ".env.local"));
const origin = String(process.env.LICIA_INTERNAL_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const secret = String(process.env.LICIA_CRON_SECRET || "").trim();
const intervalMs = Math.max(30_000, Number(process.env.LICIA_REMINDER_WORKER_INTERVAL_MS) || 60_000);

if (!origin || !secret) {
  console.error("[licia-reminder-worker] LICIA_INTERNAL_URL/APP_URL/NEXT_PUBLIC_SITE_URL dan LICIA_CRON_SECRET wajib tersedia.");
  process.exit(1);
}

async function tick() {
  try {
    const response = await fetch(`${origin}/api/reminders/dispatch`, {
      headers: { "x-licia-cron-secret": secret, "user-agent": "LiciaReminderWorker/1.0" },
      cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
    console.log(`[licia-reminder-worker] ${new Date().toISOString()} ${body}`);
  } catch (error) {
    console.error(`[licia-reminder-worker] ${new Date().toISOString()} gagal:`, error);
  }
}

await tick();
const timer = setInterval(() => { void tick(); }, intervalMs);
process.on("SIGINT", () => { clearInterval(timer); process.exit(0); });
process.on("SIGTERM", () => { clearInterval(timer); process.exit(0); });
