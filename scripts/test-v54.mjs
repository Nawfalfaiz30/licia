import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tools = readFileSync("lib/ai/tools.ts", "utf8");
const toolDefinitions = readFileSync("lib/ai/toolDefinitions.ts", "utf8");
const chatRoute = readFileSync("app/api/chat/route.ts", "utf8");
const chatOrchestrator = readFileSync("lib/ai/chatOrchestrator.ts", "utf8");
const chat = chatRoute + "\n" + chatOrchestrator;
const aiSource = tools + "\n" + toolDefinitions;
const prompt = readFileSync("lib/ai/systemPrompt.ts", "utf8");
const router = readFileSync("lib/ai/modelRouter.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

assert.match(tools, /resolveExpenseSourceAccount/);
assert.match(tools, /type === "cash"/);
assert.match(tools, /name: "Tunai"/);
assert.match(tools, /source_default: "cash"/);
assert.match(toolDefinitions, /required: \["amount", "category"\]/);
assert.match(prompt, /Jika sumber dana TIDAK disebutkan/);
assert.match(prompt, /gunakan dompet cash\/Tunai sebagai sumber otomatis/);
assert.match(router, /DEFAULT_LICIA_AI_MODEL = "gpt-6-luna"/);
assert.doesNotMatch(router, /gpt-4o-mini/);
for (const file of [
  "app/api/inbox/triage/route.ts",
  "app/api/estimate-nutrition/route.ts",
  "app/api/weekly-planner/route.ts",
  "app/api/chat/route.ts",
  "app/api/v38/daily-plan/route.ts",
  "app/api/tasks/assist/route.ts",
]) {
  const src = readFileSync(file, "utf8");
  assert.match(src, /selectAiModel/);
  assert.doesNotMatch(src, /gpt-4o-mini/);
  assert.doesNotMatch(src, /\bmax_tokens\s*:/);
  assert.match(src, /max_completion_tokens/);
}
// V56: versi minimum (>= 0.54), bukan kunci eksak 0.54.x.
assert.ok(/^0\.(5[4-9]|[6-9]\d)\./.test(pkg.version), `versi paket ${pkg.version} < 0.54`);
console.log("Licia v0.54.x AI/finance/model regression checks OK");
