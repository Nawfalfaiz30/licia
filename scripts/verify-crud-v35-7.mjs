import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const tools = read("lib/ai/tools.ts");
const routing = read("lib/ai/toolRouting.ts");
const chat = read("app/api/chat/route.ts");
const batch = read("app/api/ai/batch/route.ts");
const agent = read("lib/v35/agent.ts");
const verify = read("lib/v35/verify.ts");
const prompt = read("lib/ai/systemPrompt.ts");

const defs = [...tools.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
const uniqueDefs = [...new Set(defs)];
const cases = new Set([...tools.matchAll(/case\s+"([^"]+)":/g)].map((m) => m[1]));
const mutationNames = uniqueDefs.filter(
  (n) =>
    /^(create_|update_|delete_|log_|capture_|save_|checkin_|uncheckin_|mark_)/.test(n) ||
    ["manage_life_os_data", "transfer_money"].includes(n),
);
const missingHandlers = mutationNames.filter((n) => !cases.has(n));

const required = [
  ["81+ mutation handlers remain wired", missingHandlers.length === 0],
  ["deterministic pending confirmation helper", chat.includes("function isExplicitConfirmation")],
  [
    "confirmation bypasses model rediscovery",
    chat.includes('if (pendingAction && isExplicitConfirmation(message || ""))') &&
      chat.includes("pendingAction.confirmField"),
  ],
  [
    "candidate delete is terminal for current turn",
    chat.includes("finalText = `Aku menemukan ${labelCandidate(result.candidate)}") &&
      chat.includes('if (result?.status === "single_candidate_needs_confirmation") break;'),
  ],
  ["candidate retries are blocked in cache", chat.includes("attempts: awaitingConfirmation ? 999")],
  ["mass schedule delete remains routed", routing.includes("delete_schedule_blocks_bulk")],
  ["bulk schedule confirmation remains enforced", batch.includes("parsed.confirm_all = true")],
  [
    "semantic mutation guard remains active",
    chat.includes("function mutationApplied") && batch.includes("function mutationApplied"),
  ],
  [
    "delete verification accepts returned object id",
    verify.includes('result.deleted && typeof result.deleted === "object"'),
  ],
  ["all destructive habits are registered high-risk", agent.includes('"delete_habit"')],
  [
    "name-first personalization rule",
    prompt.includes('prioritaskan menyebut "${name}"') && prompt.includes('sapaan generik seperti "kamu"'),
  ],
  [
    "CRUD action rule",
    prompt.includes("Untuk HAPUS/UBAH") &&
      prompt.includes("bila pengguna meminta perubahan data, pilih tool CRUD domain yang sesuai"),
  ],
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error("CRUD V35.7 verification failed");
  for (const item of failed) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`CRUD V35.7 verification passed — ${mutationNames.length} mutation tools have executeTool handlers.`);
console.log("Deterministic single-delete confirmation, semantic result guards, and name-first prompting are wired.");
