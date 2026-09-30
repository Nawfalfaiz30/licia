import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const errors = [];
function expect(name, condition) { if (!condition) errors.push(name); }

const temporal = read("lib/ai/temporalGuard.ts");
expect("temporal recognizes weekday/date", /senin\|selasa\|rabu\|kamis\|jumat\|jum'at\|sabtu\|minggu/.test(temporal));
expect("temporal uses deterministic resolver", temporal.includes("resolveNaturalDate"));
expect("temporal validates weekday", temporal.includes("validateWeekdayDate"));

const routing = read("lib/ai/toolRouting.ts");
expect("calendar has resolver", routing.includes('calendar: ["get_schedule", "resolve_calendar_date"]'));
expect("read fallback includes date resolver", routing.includes('"resolve_calendar_date"'));

const chat = read("app/api/chat/route.ts");
expect("chat imports temporal guard", chat.includes('from "@/lib/ai/temporalGuard"'));
expect("chat creates temporal guard", chat.includes("const temporalGuard = buildTemporalGuard"));
expect("chat exposes resolver when temporal", chat.includes("const temporalTool = temporalGuard.active"));
expect("chat returns ai metadata", chat.includes("aiMeta:"));
expect("chat preserves privacy domains", chat.includes("deniedDomains"));

const plan = read("app/api/v38/daily-plan/route.ts");
expect("daily plan has deterministic fallback", plan.includes('source: aiSource'));
expect("daily plan uses model router", plan.includes("selectAiModel"));
expect("daily plan does not mutate calendar", plan.includes("hanya rekomendasi"));

const review = read("app/api/v38/daily-review/route.ts");
expect("review computes task completion", review.includes("completed_tasks"));
expect("review computes focus", review.includes("focus_minutes"));

const feedback = read("app/api/v38/feedback/route.ts");
expect("feedback stores structured category", feedback.includes("category"));
expect("feedback writes existing table", feedback.includes("ai_insight_feedback"));

const nav = read("components/layout/BottomNav.tsx");
expect("mobile nav has insights", nav.includes('href="/insights"'));

if (errors.length) { console.error("V38 TEST FAILED"); for (const e of errors) console.error("-", e); process.exit(1); }
console.log("Licia V38 AI regression tests OK —", [temporal, routing, chat, plan, review, feedback, nav].length, "artifacts exercised");
