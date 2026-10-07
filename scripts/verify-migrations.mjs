import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "supabase", "migrations");
const entries = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const legacy = entries.filter((name) => /^\d{4}_.+\.sql$/.test(name));
const timestamped = entries.filter((name) => /^\d{14}_.+\.sql$/.test(name));
const failures = [];
const expected = Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(4, "0"));
const actual = legacy.map((name) => name.slice(0, 4));

if (actual.length !== expected.length || actual.some((value, i) => value !== expected[i])) {
  failures.push(
    `Legacy migration chain harus tetap memiliki 0001-0015 secara berurutan; ditemukan: ${legacy.join(", ")}`,
  );
}

const timestamps = timestamped.map((name) => Number(name.slice(0, 14)));
for (let i = 1; i < timestamps.length; i++) {
  if (!Number.isSafeInteger(timestamps[i]) || timestamps[i] <= timestamps[i - 1]) {
    failures.push("Timestamped migrations harus unik dan tersusun menaik.");
    break;
  }
}

for (const [name, tokens] of [
  ["0013_finance_ledger.sql", ["current_balance", "trg_expenses_balance", "licia_transfer_money"]],
  ["0014_sync_leases.sql", ["claim_token", "lease_expires_at"]],
  ["0015_rate_limit_and_finance_summary.sql", ["licia_rate_limit", "licia_get_finance_summary"]],
]) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    failures.push(`Migration wajib tidak ditemukan: ${name}`);
    continue;
  }
  const body = fs.readFileSync(file, "utf8");
  for (const token of tokens) if (!body.includes(token)) failures.push(`${name} missing token ${token}`);
}

const requiredTimestamped = [
  "20261007120000_upgrade_platform_hardening.sql",
  "20261007130000_memory_kdf_and_runtime_hardening.sql",
  "20261007140000_observability_web_vitals.sql",
  "20261007150000_integrations_and_playbooks.sql",
  "20261007160000_google_calendar_two_way.sql",
  "20261007170000_automation_webhook_events.sql",
];

for (const name of requiredTimestamped) {
  if (!timestamped.includes(name)) failures.push(`Timestamped migration wajib tidak ditemukan: ${name}`);
}

const version = JSON.parse(fs.readFileSync(path.join(root, "config/licia-version.json"), "utf8"));
if (Number(version.schemaVersion) !== 41) failures.push("config/licia-version.json schemaVersion harus 41.");
if (Number(version.pwaDbVersion) !== 4) failures.push("config/licia-version.json pwaDbVersion harus 4.");

if (failures.length) {
  console.error(`Canonical DB/Version check FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Canonical DB/Version check OK — legacy ${legacy.length}, timestamped ${timestamped.length}, schema v${version.schemaVersion}, PWA DB v${version.pwaDbVersion}.`,
);
