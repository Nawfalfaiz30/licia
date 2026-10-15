import fs from "node:fs";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const chat = readFileSync(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const chatOrchestrator = readFileSync(new URL("../lib/ai/chatOrchestrator.ts", import.meta.url), "utf8");
const chatRuntimeSource = chat + "\n" + chatOrchestrator;
const historySchema = readFileSync(new URL("../supabase/schema_ai_chat_history.sql", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const runtime = readFileSync(new URL("../lib/ai/runtime.ts", import.meta.url), "utf8");
assert.match(runtime, /export function generationOptions/);
assert.match(runtime, /LICIA_AI_OMIT_TEMPERATURE/);
assert.match(runtime, /LICIA_AI_REASONING_EFFORT/);

for (const file of [
  "lib/ai/chatOrchestrator.ts",
  "app/api/weekly-planner/route.ts",
  "app/api/v38/daily-plan/route.ts",
  "app/api/inbox/triage/route.ts",
  "app/api/estimate-nutrition/route.ts",
  "app/api/tasks/assist/route.ts",
]) {
  const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(src, /generationOptions\(/);
  assert.match(src, /chatCompletion\(/);
}

// V56: versi minimum (>= 0.54), bukan kunci eksak 0.54.x yang membuat `npm test` gagal di setiap rilis baru.
assert.ok(/^0\.(5[4-9]|[6-9]\d)\./.test(pkg.version), `versi paket ${pkg.version} < 0.54`);
assert.ok(fs.existsSync(new URL("../DEPLOY_VPS.md", import.meta.url)));
assert.match(runtime, /reasoning_effort/);
assert.match(runtime, /unsupportedGenerationParameter/);
assert.match(chatRuntimeSource, /tools:\s*selectedTools/);
assert.match(chatRuntimeSource, /tools:\s*recoveryTools/);
assert.match(chatRuntimeSource, /selectAiToolModel/);
assert.match(chatRuntimeSource, /pendingActionId/);
assert.match(chatRuntimeSource, /loadServerPendingAction/);
assert.match(chatOrchestrator, /export async function chatDelete/);
const validatorUrl = new URL("../lib/ai/toolValidation.ts", import.meta.url).href;
const behaviorScript = `
import { validateToolArguments } from ${JSON.stringify(validatorUrl)};
import { chatCompletion, generationOptions } from ${JSON.stringify(new URL("../lib/ai/runtime.ts", import.meta.url).href)};
const defs = [{ type: 'function', function: { name: 'demo', parameters: { type: 'object', properties: { amount: { type: 'number' }, label: { type: 'string' } }, required: ['amount'] } } }];
process.env.LICIA_AI_OMIT_TEMPERATURE = 'true';
process.env.LICIA_AI_REASONING_EFFORT = 'none';
const gpt6 = generationOptions('gpt-6-luna', 0.1);
const other = generationOptions('arbitrary-model', 0.1);
if ('temperature' in gpt6) process.exit(4);
if (gpt6.reasoning_effort !== 'none') process.exit(5);
if ('temperature' in other) process.exit(6);
process.env.LICIA_AI_OMIT_TEMPERATURE = 'false';
const tuned = generationOptions('gpt-4o', 0.1);
if (tuned.temperature !== 0.1) process.exit(7);
if (tuned.reasoning_effort !== 'none') process.exit(8);
let calls = 0;
const fakeClient = { chat: { completions: { create: async (params) => {
  calls += 1;
  if (calls === 1) throw Object.assign(new Error("Unsupported value: 'temperature' does not support 0.1 with this model. Only the default (1) value is supported."), { status: 400 });
  if ('temperature' in params) throw new Error('temperature should have been removed');
  return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{}' } }], usage: {} };
} } } };
const completion = await chatCompletion(fakeClient, { model: 'custom-reasoning-model', messages: [], temperature: 0.1, reasoning_effort: 'none' });
if (calls !== 2 || completion.choices?.[0]?.message?.content !== '{}') process.exit(9);
let reasoningCalls = 0;
const reasoningClient = { chat: { completions: { create: async (params) => {
  reasoningCalls += 1;
  if (reasoningCalls === 1) throw Object.assign(new Error("Unsupported parameter: 'reasoning_effort' is not supported for this model."), { status: 400 });
  if ('reasoning_effort' in params) throw new Error('reasoning_effort should have been removed');
  return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{}' } }], usage: {} };
} } } };
await chatCompletion(reasoningClient, { model: 'custom-model', messages: [], reasoning_effort: 'none' });
if (reasoningCalls !== 2) process.exit(10);
process.env.LICIA_AI_REASONING_EFFORT = '';
if ('reasoning_effort' in generationOptions('custom-model', 0.1)) process.exit(11);
if (!validateToolArguments(defs, 'demo', { amount: 100 }).ok) process.exit(1);
if (validateToolArguments(defs, 'demo', {}).ok) process.exit(2);
if (validateToolArguments(defs, 'demo', { amount: '100' }).ok) process.exit(3);
`;
execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", behaviorScript], {
  stdio: "ignore",
});
const validation = readFileSync(new URL("../lib/ai/toolValidation.ts", import.meta.url), "utf8");
assert.match(validation, /validateToolArguments/);
assert.match(validation, /INVALID_TOOL_ARGUMENTS/);
assert.match(historySchema, /create table if not exists public.ai_chat_messages/);
assert.match(historySchema, /auth.uid\(\) = user_id/);
assert.match(historySchema, /ai_chat_messages_turn_unique_idx/);
console.log("Licia v0.54.4 reasoning/tool/server-action checks OK");
