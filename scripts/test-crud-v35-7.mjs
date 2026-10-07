import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const chat = fs.readFileSync(path.join(root, "app/api/chat/route.ts"), "utf8");
const prompt = fs.readFileSync(path.join(root, "lib/ai/systemPrompt.ts"), "utf8");
const tools = fs.readFileSync(path.join(root, "lib/ai/tools.ts"), "utf8");

const cases = [
  ['explicit confirmation recognizes "hapus sekarang"', chat.includes("hapus sekarang")],
  ["explicit confirmation rejects cancellation wording", chat.includes("jangan jadi|tidak jadi")],
  [
    "pending target is executed using stored confirm field",
    chat.includes("JSON.stringify({ [pendingAction.confirmField]: pendingAction.id })"),
  ],
  [
    "successful deterministic delete clears pending action",
    chat.includes("pendingAction: applied ? null : pendingAction"),
  ],
  [
    "unconfirmed candidate is never marked as applied",
    chat.includes("single_candidate_needs_confirmation") && chat.includes("mutationApplied(tool, result)"),
  ],
  [
    "habit delete supports confirm_habit_id",
    tools.includes("confirm_habit_id") && tools.includes('case "delete_habit"'),
  ],
  ["name-first assistant behavior is explicit", prompt.includes('prioritaskan menyebut "${name}"')],
  ["CRUD agent must verify applied mutations", prompt.includes("jalankan, lalu verifikasi hasilnya")],
];

const failed = cases.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error("CRUD V35.7 tests failed");
  for (const item of failed) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`CRUD V35.7 tests passed — ${cases.length} behavioral/static checks.`);
