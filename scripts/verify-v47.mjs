import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const text = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

const nav = text('components/layout/nav-items.ts');
const more = text('components/layout/MoreSheet.tsx');
const chat = text('components/chat/ChatWidget.tsx');
const bottom = text('components/layout/BottomNav.tsx');
const tasks = text('app/(app)/tasks/page.tsx');
const finance = text('app/(app)/finance/page.tsx');
const guide = text('app/(app)/guide/page.tsx');
const settings = text('app/(app)/settings/page.tsx');
const pkg = JSON.parse(text('package.json'));
const lock = JSON.parse(text('package-lock.json'));

assert(pkg.version === '0.47.0' && lock.version === '0.47.0', 'release metadata mismatch');
assert(nav.includes('item("/insights", "Insights", "insights", Lightbulb, true)'), 'Insights must remain a primary workspace');
assert(nav.includes('item("/insights#life-map", "Peta & Relasi"'), 'merged map shortcut missing');
assert(nav.includes('item("/insights#analytics", "Review & Pola"'), 'merged review shortcut missing');
assert(nav.includes('item("/automations", "Otomasi"'), 'automation shortcut missing');
assert((nav.match(/group\(\"Workspace utama\"/g) || []).length === 2, 'desktop/mobile workspace catalog count unexpected');
assert((nav.match(/item\(\"\/insights\", \"Insights\"/g) || []).length === 2, 'desktop/mobile Insights catalog count unexpected');
assert(bottom.includes('visiblePrimary') && bottom.includes('MoreSheet'), 'mobile MoreSheet wiring missing');
assert(more.includes('All features') || more.includes('Semua fitur'), 'MoreSheet all-features header missing');
assert(chat.includes('chat-v46-menu') && chat.includes('successfulActions') && chat.includes('Batalkan'), 'chat action hierarchy missing');
assert(!/chat\?prompt=.*(Prioritas|Agenda|Tugas)/i.test(tasks), 'task bridge still uses Chat prompt');
assert(tasks.includes('mutateEntity({ entityType: "task", operation: "update"'), 'priority action does not mutate tasks directly');
assert(tasks.includes('mutateEntity({ entityType: "schedule", operation: "create"'), 'task-to-agenda does not create schedule directly');
assert(finance.includes('Langganan & Tagihan') && finance.includes('Komitmen rutin'), 'Finance recurring commitments are not visible');
assert(guide.includes('Lainnya di ponsel') && guide.includes('Agenda → Tugas') && guide.includes('Tugas → Agenda'), 'Guide behavior coverage incomplete');
assert(!/V\d{2}(?:\.\d+)?/i.test(guide) && !/V\d{2}(?:\.\d+)?/i.test(settings), 'user-facing docs contain internal release labels');
console.log('Licia 0.46 verify OK');
