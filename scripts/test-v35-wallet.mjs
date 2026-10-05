import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");
const tools = read("lib/ai/tools.ts");
const sync = read("app/api/sync/mutation/route.ts");
const migration = read("supabase/schema_v35_1_finance_wallet.sql");
const prompt = read("lib/ai/systemPrompt.ts");
const batch = read("app/api/ai/batch/route.ts");

const must = (ok, message) => { if (!ok) throw new Error(message); console.log(`PASS ${message}`); };

must(tools.includes('account_name') && tools.includes('logExpense'), 'AI expense wallet resolution');
must(tools.includes('transfer_money') && tools.includes('get_account_transactions'), 'wallet transfer + transaction tools');
must(sync.includes('accountTransfer: { table: "account_transfers"'), 'sync account transfer entity');
must(migration.includes('create table if not exists public.account_transfers'), 'wallet transfer migration');
must(migration.includes('account_type') && migration.includes('is_default'), 'wallet metadata migration');
must(prompt.includes('WAJIB kirim nama dompet tersebut ke log_expense'), 'AI wallet instruction');
must(batch.includes('coreMark') && batch.includes('metadataResult'), 'AI pending metadata split');
console.log('V35 wallet tests passed');
