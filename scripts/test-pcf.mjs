import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const requiredFiles = [
  "lib/ai/toolDefinitions.ts",
  "lib/ai/toolExecutor.ts",
  "lib/ai/chatOrchestrator.ts",
  "lib/ai/tools.ts",
  "lib/version.ts",
  "config/licia-version.json",
  "app/api/finance/summary/route.ts",
  "supabase/migrations/0013_finance_ledger.sql",
  "supabase/migrations/0014_sync_leases.sql",
  "supabase/migrations/0015_rate_limit_and_finance_summary.sql",
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push("Missing: " + file);
}

const route = read("app/api/chat/route.ts");
if (!route.includes("chatOrchestrator")) failures.push("Chat route is not thin/controller-only.");
if (!route.includes("export const POST = chatPost")) failures.push("Chat POST boundary missing.");

const executor = read("lib/ai/toolExecutor.ts");
if (!executor.includes("validateToolArguments")) failures.push("Tool executor validation missing.");
if (!executor.includes("toolHandlers")) failures.push("Tool executor handler registry missing.");

const tools = read("lib/ai/tools.ts");
if (!tools.includes("export const toolHandlers")) failures.push("AI handler registry missing.");
if (!tools.includes("import { toolDefs }")) failures.push("AI tool definitions are not separated.");

const sync = read("app/api/sync/mutation/route.ts");
for (const token of ["claim_token", "lease_expires_at", 'eq("claim_token", claimToken)']) {
  if (!sync.includes(token)) failures.push("Sync lease guard missing " + token);
}

const version = JSON.parse(read("config/licia-version.json"));
if (version.appVersion !== "0.58.0") failures.push("Unexpected appVersion in version metadata.");
if (Number(version.schemaVersion) !== 42) failures.push("Unexpected schemaVersion in version metadata.");
if (Number(version.pwaDbVersion) !== 4) failures.push("Unexpected pwaDbVersion in version metadata.");

const migrationDir = path.join(root, "supabase", "migrations");
const migrations = fs
  .readdirSync(migrationDir)
  .filter((x) => /^\d{4}_.+\.sql$/.test(x))
  .sort();
const expected = Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(4, "0"));
if (migrations.length !== expected.length || migrations.some((x, i) => x.slice(0, 4) !== expected[i])) {
  failures.push("Canonical migration sequence is not exactly 0001-0015.");
}

const ledger = read("supabase/migrations/0013_finance_ledger.sql");
for (const token of [
  "current_balance",
  "trg_expenses_balance",
  "trg_incomes_balance",
  "trg_account_transfers_balance",
  "licia_transfer_money",
]) {
  if (!ledger.includes(token)) failures.push("Finance ledger migration missing " + token);
}

const rate = read("supabase/migrations/0015_rate_limit_and_finance_summary.sql");
for (const token of [
  "licia_rate_limit_buckets",
  "licia_rate_limit",
  "licia_get_ai_usage_total",
  "licia_get_finance_summary",
]) {
  if (!rate.includes(token)) failures.push("PCF aggregation/limit migration missing " + token);
}

if (failures.length) {
  console.error("PCF regression check FAILED (" + failures.length + ")");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log(
  "PCF regression check OK — architecture boundaries, ledger, sync leases, versions, and canonical migrations verified.",
);
