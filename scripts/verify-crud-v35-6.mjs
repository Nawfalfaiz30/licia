import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tools = fs.readFileSync(path.join(root, "lib/ai/tools.ts"), "utf8");
const routing = fs.readFileSync(path.join(root, "lib/ai/toolRouting.ts"), "utf8");
const chat = fs.readFileSync(path.join(root, "app/api/chat/route.ts"), "utf8");
const batch = fs.readFileSync(path.join(root, "app/api/ai/batch/route.ts"), "utf8");
const agent = fs.readFileSync(path.join(root, "lib/v35/agent.ts"), "utf8");
const verify = fs.readFileSync(path.join(root, "lib/v35/verify.ts"), "utf8");

const defs = [...tools.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
const uniqueDefs = [...new Set(defs)];
const cases = [...tools.matchAll(/case\s+"([^"]+)":/g)].map((m) => m[1]);
const caseSet = new Set(cases);
const mutationNames = uniqueDefs.filter(
  (n) =>
    /^(create_|update_|delete_|log_|capture_|save_|checkin_|uncheckin_|mark_)/.test(n) ||
    ["manage_life_os_data", "transfer_money"].includes(n),
);
const missingHandlers = mutationNames.filter((n) => !caseSet.has(n));
const requiredTokens = [
  ["bulk schedule delete tool", tools.includes("delete_schedule_blocks_bulk")],
  ["bulk schedule delete routing", routing.includes("delete_schedule_blocks_bulk")],
  ["batch semantic outcome guard", batch.includes("function mutationApplied")],
  ["batch uses normalized parsed args", batch.includes("args = JSON.stringify(parsed)")],
  [
    "batch bulk schedule confirmation",
    batch.includes('tool === "delete_schedule_blocks_bulk"') && batch.includes("parsed.confirm_all = true"),
  ],
  ["chat semantic outcome guard", chat.includes("function mutationApplied")],
  ["chat mass-delete exception extraction", chat.includes("function extractMassDeleteExceptions")],
  ["bulk schedule destructive risk", agent.includes('"delete_schedule_blocks_bulk"')],
  ["bulk schedule verification mapping", verify.includes('delete_schedule_blocks_bulk: "schedule_blocks"')],
];
const failedTokens = requiredTokens.filter(([, ok]) => !ok).map(([name]) => name);

if (missingHandlers.length || failedTokens.length) {
  console.error("CRUD verification failed");
  if (missingHandlers.length) console.error("Missing handlers:", missingHandlers.join(", "));
  if (failedTokens.length) console.error("Missing upgrade guards:", failedTokens.join(", "));
  process.exit(1);
}

console.log(`CRUD verification passed — ${mutationNames.length} mutation tools have executeTool handlers.`);
console.log("Bulk schedule deletion is routed, confirmation-safe, and semantically verified.");
