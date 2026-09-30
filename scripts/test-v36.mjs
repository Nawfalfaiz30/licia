import fs from 'node:fs';
const root=process.cwd();
const checks=[
 ['Temporal engine', fs.existsSync('lib/v36/temporal.ts')],
 ['Copilot engine', fs.existsSync('lib/v36/intelligence.ts')],
 ['Temporal API', fs.existsSync('app/api/v36/temporal/route.ts')],
 ['Copilot API', fs.existsSync('app/api/v36/copilot/route.ts')],
 ['Search API', fs.existsSync('app/api/v36/search/route.ts')],
 ['Review API', fs.existsSync('app/api/v36/review/route.ts')],
 ['Feedback API', fs.existsSync('app/api/v36/feedback/route.ts')],
 ['Privacy Center', fs.existsSync('app/(app)/privacy/page.tsx')],
 ['Calendar Intelligence', fs.existsSync('components/v36/CalendarIntelligence.tsx')],
 ['Offline Workspace', fs.existsSync('components/v36/OfflineWorkspace.tsx')],
 ['V36 schema', fs.existsSync('supabase/schema_v36_intelligence.sql')],
 ['Evidence fields', /add column if not exists evidence/.test(fs.readFileSync('supabase/schema_v36_intelligence.sql','utf8'))],
 ['Temporal validation', /validateWeekdayDate/.test(fs.readFileSync('lib/v36/temporal.ts','utf8'))],
];
let ok=true; for(const [label,pass] of checks){ console.log(`${pass?'PASS':'FAIL'} ${label}`); ok=ok&&pass; } if(!ok) process.exit(1); console.log('V36 tests passed');
