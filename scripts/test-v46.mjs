import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const nav = read('components/layout/nav-items.ts');
const bottom = read('components/layout/BottomNav.tsx');
const more = read('components/layout/MoreSheet.tsx');
const chat = read('components/chat/ChatWidget.tsx');
const tasks = read('app/(app)/tasks/page.tsx');
const finance = read('app/(app)/finance/page.tsx');
const guide = read('app/(app)/guide/page.tsx');
const settings = read('app/(app)/settings/page.tsx');
const i18n = read('lib/i18n.ts');

assert(pkg.version === '0.46.0' && lock.version === '0.46.0', 'package version must be 0.46.0');
assert(nav.includes('Workspace utama') && nav.includes('/goals-projects') && nav.includes('/knowledge') && nav.includes('/finance') && nav.includes('/wellbeing'), 'canonical workspaces are incomplete');
assert(!/group\("Wawasan"\s*,\s*"nav_insights"/.test(nav), 'desktop still exposes a duplicate Insights group');
for (const legacy of ['item("/goals"', 'item("/projects"', 'item("/subscriptions"', 'item("/notes"', 'item("/memory"', 'item("/vault"', 'item("/reading"', 'item("/habits"', 'item("/analytics"', 'item("/timeline"', 'item("/life-copilot"', 'item("/command"']) {
  assert(!nav.includes(legacy), `legacy merged feature leaked into navigation: ${legacy}`);
}
assert(bottom.includes('const visiblePrimary = primaryNavItems.slice(0, 4)'), 'mobile footer must reserve the fifth slot for Lainnya');
assert(bottom.includes('Lainnya') && bottom.includes('Buka semua fitur di Lainnya'), 'mobile footer Lainnya action is missing');
assert(more.includes('Semua fitur') && more.includes('Cari fitur atau workspace') && more.includes('bagian dari workspace induk'), 'MoreSheet needs complete feature catalog copy');
assert(!more.includes('Langganan') || !more.includes('item("/finance"'), 'subscription must not return as a duplicate mobile item');
assert(chat.includes('chat-v46') && chat.includes('chat-v46-action') && chat.includes('Mulai dari mana saja.'), 'chat v46 compact shell missing');
assert(!chat.includes('RINGKASAN AKSI') && !chat.includes('Ringkasan aksi'), 'old large action summary leaked into Chat');
assert(tasks.includes('async function runPriorityPlan') && tasks.includes('async function convertAgendaToTasks') && tasks.includes('async function scheduleOpenTasks'), 'direct task action handlers missing');
assert(!/href=["'`]\/chat\?prompt/i.test(tasks), 'task actions must not redirect to Chat');
for (const label of ['Prioritas dengan Licia', 'Agenda → Tugas', 'Tugas → Agenda', 'Agenda → Pengingat']) assert(tasks.includes(label), `direct task action ${label} missing`);
assert(finance.includes("['subscriptions','Langganan & Tagihan']") && finance.includes('Tambah langganan') && finance.includes('recordSubscriptionCharge'), 'Finance subscription integration missing');
assert(settings.includes('Data & Akun') && settings.includes('Kesehatan & Rutinitas') && settings.includes('Peta & Relasi'), 'Settings is not aligned with merged workspaces');
assert(!/\bV\d{2}(?:\.\d+)?\b/i.test(guide), 'Guide contains an internal version label');
assert(!/\bV\d{2}(?:\.\d+)?\b/i.test(settings), 'Settings contains an internal version label');
assert(i18n.includes('nav_insights: "Wawasan & Otomasi"'), 'i18n label for merged Insights group is missing');

console.log('Licia 0.46 UX refinement tests OK — all checks passed');
