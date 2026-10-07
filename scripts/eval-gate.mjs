import fs from "node:fs";
import process from "node:process";

const file = process.env.LICIA_EVAL_CASES || "evals/golden-upgrade-150.json";
if (!fs.existsSync(file)) {
  console.error("Eval corpus tidak ditemukan: " + file);
  process.exit(1);
}
const input = JSON.parse(fs.readFileSync(file, "utf8"));
const rows = Array.isArray(input) ? input : input.cases;
if (!Array.isArray(rows) || rows.length < 150) {
  console.error("Eval gate FAILED: " + (rows?.length || 0) + " kasus; minimal 150.");
  process.exit(1);
}
const requiredTags = ["id", "en", "multi-turn", "indirect-injection", "mutation", "read", "ambiguity"];
const observed = new Set(rows.flatMap((x) => Array.isArray(x.tags) ? x.tags : []));
const missing = requiredTags.filter((x) => !observed.has(x));
if (missing.length) {
  console.error("Eval gate FAILED: tag wajib hilang: " + missing.join(", "));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, cases: rows.length, coveredTags: [...observed].sort() }));
