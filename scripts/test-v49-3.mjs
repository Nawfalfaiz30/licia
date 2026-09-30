import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const detailRoutes = [
  'notes','vault','reading','learning','memory','health','habits','goals','projects',
  'today','reminders','planner','inbox','analytics','timeline','life-map','life-graph',
  'brief','review-center','sync','system','privacy','ai-history','pulse','command'
];
for (const route of detailRoutes) {
  const file = `app/(app)/${route}/page.tsx`;
  if (!exists(file)) throw new Error(`Missing detail route: ${route}`);
}
for (const [route, target] of [['notes','/knowledge'],['memory','/knowledge'],['vault','/knowledge'],['reading','/knowledge'],['learning','/knowledge']]) {
  const body = read(`app/(app)/${route}/page.tsx`);
  if (/redirect\(\s*"\/knowledge"/.test(body)) throw new Error(`${route} still redirects to ${target}`);
}
if (!read('public/sw.js').includes("req.headers.get('RSC') === '1'")) throw new Error('RSC bypass missing');
if (!read('proxy.ts').includes('"/knowledge/:path*"')) throw new Error('Canonical route proxy coverage missing');
if (!read('app/(app)/insights/page.tsx').includes('href={id}')) throw new Error('Insights detail links not converted');
console.log('Licia V49.3 navigation/runtime regression tests OK — all checks passed');
