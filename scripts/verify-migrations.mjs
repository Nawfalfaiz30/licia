import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "supabase", "migrations");
const entries = fs.readdirSync(dir).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
const failures = [];
const expected = Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(4, "0"));
const actual = entries.map((name) => name.slice(0, 4));

if (actual.length !== expected.length || actual.some((value, i) => value !== expected[i])) {
  failures.push(`Canonical migration chain harus memiliki 0001-0015 secara berurutan; ditemukan: ${entries.join(", ")}`);
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
  const text = fs.readFileSync(file, "utf8");
  for (const token of tokens) if (!text.includes(token)) failures.push(`${name} missing token ${token}`);
}
const version = JSON.parse(fs.readFileSync(path.join(root, "config/licia-version.json"), "utf8"));
if (Number(version.schemaVersion) !== 41) failures.push("config/licia-version.json schemaVersion harus 41.");
if (Number(version.pwaDbVersion) !== 4) failures.push("config/licia-version.json pwaDbVersion harus 4.");

if (failures.length) {
  console.error(`Canonical DB/Version check FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Canonical DB/Version check OK — ${entries.length} migrations, schema v${version.schemaVersion}, PWA DB v${version.pwaDbVersion}.`);
