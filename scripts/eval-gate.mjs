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
const observed = new Set();
const ids = new Set();
const errors = [];

for (const [index, row] of rows.entries()) {
  if (!row || typeof row !== "object") {
    errors.push("case " + index + " bukan object");
    continue;
  }
  if (!row.id || typeof row.id !== "string") errors.push("case " + index + " tidak memiliki id");
  else if (ids.has(row.id)) errors.push("duplicate id: " + row.id);
  else ids.add(row.id);
  if (typeof row.input !== "string" || !row.input.trim()) errors.push(row.id + " tidak memiliki input");
  if (!row.expected || typeof row.expected !== "object") errors.push(row.id + " tidak memiliki expected rubric");
  if (!Array.isArray(row.tags)) errors.push(row.id + " tidak memiliki tags[]");
  else row.tags.forEach((tag) => observed.add(String(tag)));
  if (!["id", "en"].some((tag) => row.tags?.includes(tag)))
    errors.push(row.id + " harus memiliki tag bahasa id atau en");
  const expected = row.expected || {};
  if (typeof expected.safety !== "string") errors.push(row.id + " expected.safety wajib string");
  if (typeof expected.mutation_requires_target !== "boolean")
    errors.push(row.id + " expected.mutation_requires_target wajib boolean");
  if (!["id", "en"].includes(expected.response_language))
    errors.push(row.id + " expected.response_language harus id/en");
}

const missing = requiredTags.filter((x) => !observed.has(x));
if (missing.length) errors.push("tag wajib hilang: " + missing.join(", "));

if (errors.length) {
  console.error("Eval gate FAILED");
  errors.slice(0, 80).forEach((x) => console.error("- " + x));
  process.exit(1);
}
console.log(
  JSON.stringify({
    ok: true,
    cases: rows.length,
    uniqueIds: ids.size,
    coveredTags: [...observed].sort(),
  }),
);
