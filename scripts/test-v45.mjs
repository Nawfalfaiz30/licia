import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const nav = read('components/layout/nav-items.ts');
const more = read('components/layout/MoreSheet.tsx');
const chat = read('components/chat/ChatWidget.tsx');
const tasks = read('app/(app)/tasks/page.tsx');
const finance = read('app/(app)/finance/page.tsx');
const guide = read('app/(app)/guide/page.tsx');
const settings = read('app/(app)/settings/page.tsx');
const pkg = JSON.parse(read('package.json'));

assert(pkg.version === '0.45.0', 'package version must be 0.45.0');
assert(nav.includes('nav_workspace_main') && nav.includes('nav_insights'), 'canonical navigation groups are missing');
assert(nav.includes('calendar_reminders') && nav.includes('planner_inbox'), 'merged Rencana shortcuts are missing');
assert(nav.includes('life_map_relations') && nav.includes('review_patterns'), 'merged Insights shortcuts are missing');
for (const legacy of ['subscriptions', 'notes', 'memory', 'vault', 'reading', 'habits', 'projects', 'goals', 'timeline', 'analytics', 'life_graph', 'review_center', 'life_copilot', 'command', 'pulse', 'privacy_center', 'system_center', 'sync_center']) {
  assert(!nav.includes(`"${legacy}"`) || ['goals_projects'].includes(legacy), `legacy duplicate nav key leaked: ${legacy}`);
}
assert(more.includes('Lainnya') && more.includes('fitur yang sudah digabung'), 'mobile MoreSheet copy is incomplete');
assert(chat.includes('hidden min-h-4 items-center') && chat.includes('group/chat-row'), 'chat metadata was not compacted for mobile');
assert(!tasks.includes('/chat?prompt='), 'task actions must not redirect to Chat');
assert(tasks.includes('async function runPriorityPlan') && tasks.includes('async function convertAgendaToTasks') && tasks.includes('async function scheduleOpenTasks'), 'direct task action handlers missing');
assert(finance.includes('tab==="subscriptions"') && finance.includes('recordSubscriptionCharge'), 'subscription integration inside Finance is missing');
assert(!/\bV\d{2}(?:\.\d+)?\b/i.test(guide), 'Guide must not expose internal version labels');
assert(!/\bV\d{2}(?:\.\d+)?\b/i.test(settings), 'Settings must not expose internal version labels');
assert(settings.includes('Kesehatan & Rutinitas') && settings.includes('Peta & Relasi') && settings.includes('Review & Pola'), 'Settings is not aligned with merged workspace structure');

console.log('Licia 0.45 UX regression tests OK — all checks passed');
