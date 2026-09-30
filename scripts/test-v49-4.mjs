import fs from 'node:fs';
const root=new URL('..', import.meta.url).pathname.replace(/\/$/,'');
const read=p=>fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
const route=read('app/api/chat/route.ts');
const tools=read('lib/ai/tools.ts');
const routing=read('lib/ai/toolRouting.ts');
const verify=read('lib/v35/verify.ts');
function must(x,m){if(!x) throw new Error('V49.4 regression: '+m)}
must(tools.includes('name: "delete_all_reminders"'),'bulk reminder tool missing');
must(tools.includes('args.confirm !== true'),'bulk reminder must require explicit confirm');
must(tools.includes('from("reminders")'),'bulk reminder must operate on reminders table');
must(route.includes('hasRecentAllReminderDeletePrompt'),'text confirmation after reminder preview must be deterministic');
must(route.includes('isAllReminderDeleteRequest'),'direct all-reminder requests must be handled deterministically');
must(routing.includes('"delete_all_reminders"'),'bulk reminder tool must be routed');
must(verify.includes('delete_all_reminders') && verify.includes('database-readback-bulk-delete'),'bulk reminder mutation must be verified');
console.log('Licia V49.4 reminder regression OK');
