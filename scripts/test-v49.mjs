import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
function assert(condition, message) { if (!condition) throw new Error(`V49 regression: ${message}`); }
const route = read("app/api/chat/route.ts");
const routing = read("lib/ai/toolRouting.ts");
const convo = read("lib/ai/conversationIntelligence.ts");
const verify = read("lib/v35/verify.ts");
const chat = read("components/chat/ChatWidget.tsx");
assert(route.includes("conversationStateInput") && route.includes("conversationDecision"), "Chat route must carry conversation state and decisioning");
assert(route.includes("const routingText = effectiveMessage.trim()"), "Tool routing must use current message rather than full chat history");
assert(route.includes("conversationDecision.mutationExpected && !conversationDecision.destructiveIntent") && route.includes('tool_choice: conversationDecision'), "Non-destructive mutation requests must require a tool call");
assert(route.includes("chat_recovery") && route.includes("Final honesty guard"), "Mutation recovery and honesty guard missing");
assert(route.includes("if (!isMutationToolName(tool)) return false"), "Read-only tools must never be counted as executed mutations");
assert(route.includes("isMutationToolName(call.function.name) ? (applied ? \"success\" : \"error\") : (result?.ok ? \"success\" : \"error\")"), "Read/write action log status must be separated");
assert(routing.includes("selectMutationToolDefs"), "Mutation-only recovery tool selector missing");
assert(convo.includes("topicSwitched") && convo.includes("PRIORITAS PEMAHAMAN"), "Topic boundary logic missing");
assert(convo.includes("financeStrong") && convo.includes("healthExplicit"), "Finance-versus-health ambiguity guard missing");
assert(verify.includes("expectedArgs") && verify.includes("database-readback-batch"), "Strict mutation verification missing");
assert(verify.includes("unmapped-mutation") && verify.includes("sameTimestamp"), "Mutation verification must fail closed for unmapped tools and normalize timestamps");
assert(routing.includes("delete_all_reminders"), "Reminder routing must expose bulk reminder deletion");
assert(chat.includes("STORAGE_CONVERSATION_STATE") && chat.includes("chat-v50-action-receipt"), "Conversation state or compact action receipt missing");
assert(!chat.includes('successfulActions.length > 0'), "Successful actions must not render as a permanent standalone panel");

const runtimeSource = read("lib/ai/runtime.ts");
assert(runtimeSource.includes("AbortError"), "runtime must recognize AbortError");
assert(runtimeSource.includes("signal?: AbortSignal"), "runtime retry must accept an abort signal");
const toolsSource = read("lib/ai/tools.ts");
assert(toolsSource.includes("cleanScheduleDeleteKeyword"), "schedule delete must normalize natural-language keywords");
assert(toolsSource.includes('name: "delete_all_reminders"') && toolsSource.includes('async function deleteAllReminders'), "bulk reminder deletion tool missing");
assert(route.includes("isAllReminderDeleteRequest") && route.includes("hasRecentAllReminderDeletePrompt"), "deterministic bulk reminder confirmation path missing");
assert(verify.includes("delete_all_reminders") && verify.includes("database-readback-bulk-delete"), "bulk reminder delete verification missing");

console.log("Licia V49 AI intelligence regression tests OK — all checks passed");
