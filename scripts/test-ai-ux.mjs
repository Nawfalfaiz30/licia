import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const assert = (ok, message) => { if (!ok) throw new Error(`AI/UX regression: ${message}`); };

const convo = read("lib/ai/conversationIntelligence.ts");
const prompt = read("lib/ai/systemPrompt.ts");
const context = read("lib/ai/context.ts");
const route = read("app/api/chat/route.ts");
const tools = read("lib/ai/tools.ts");
const settings = read("app/(app)/settings/page.tsx");
const chat = read("components/chat/ChatWidget.tsx");
const bottom = read("components/layout/BottomNav.tsx");
const dashboard = read("app/(app)/dashboard/page.tsx");

assert(convo.includes("propertyFollowUpPattern") && convo.includes("catatannya"), "property follow-up routing missing");
assert(convo.includes("recentAssistantText") && convo.includes("inferDomainFromRecentAssistant"), "stale context recovery missing");
assert(convo.includes("sanitizeEntityIds") && convo.includes("UUID_PATTERN"), "entity ID sanitization missing");
assert(prompt.includes("JANGAN PERNAH mengirim nomor urut") && prompt.includes("EDIT PROPERTI"), "target resolution instructions missing");
assert(context.includes("select(\"id,amount,category,note,occurred_at\")") && context.includes("[id: ${t.id}]"), "connected context must expose real IDs");
assert(route.includes("recentAssistantText") && route.includes("ENTITY_UUID_RE"), "chat route continuity/entity validation missing");
assert(convo.includes("assistantMutationProposalPattern") && convo.includes("confirmsRecentMutationProposal"), "confirmation-to-mutation continuity missing");
assert(route.includes("confirmationRoutingHint") && route.includes("[konfirmasi aksi: ubah]"), "confirmed mutation routing hint missing");
assert(tools.includes('name: "get_life_os_capabilities"') && tools.includes('case "get_life_os_capabilities"'), "Life OS capability discovery tool missing");
assert(tools.includes('"smart_inbox_item"') && tools.includes('"memory"'), "fallback CRUD does not expose Smart Inbox/Memory entities");
assert(tools.includes("INVALID_ENTITY_ID") && tools.includes("expenseId"), "invalid UUID guard missing for expense update");
assert(tools.includes("noteId") && tools.includes("ID catatan tidak valid"), "invalid UUID guard missing for note update");
assert(settings.includes("Atur Licia sesuai caramu") && settings.includes("Pilih yang penting. Licia menyesuaikan sisanya."), "settings hero not simplified");
assert(settings.includes("Bahasa antarmuka") && settings.includes("applyAiPreset"), "settings UX language/preset upgrade missing");
assert(chat.includes("resetConversationContext") && chat.includes("Konfirmasi hapus"), "chat context/confirmation UX missing");
assert(bottom.includes("visiblePrimary") && bottom.includes('/finance') && bottom.includes('"Hari Ini"'), "mobile nav primary footer is missing expected Phase 1 items");
assert(!bottom.includes('href: "/capture"'), "Capture must not occupy the mobile primary footer in Phase 1");
assert(dashboard.includes("const smartMove =") && dashboard.includes("Prioritas sekarang"), "dashboard next-move card missing");

console.log("Licia AI/UX regression tests OK");
