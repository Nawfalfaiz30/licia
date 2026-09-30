import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { buildCopilotContext } from "@/lib/v36/intelligence";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const url = new URL(req.url); const q = String(url.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, query: q, results: [], related: [] });
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const queries = [
    ["tasks", "Tugas", "id,title,status,priority,due_at,project_id", `title.ilike.${like}`, "/tasks"],
    ["projects", "Proyek", "id,name,status,target_date,goal_id", `name.ilike.${like}`, "/projects"],
    ["goals", "Target", "id,title,status,progress,target_date,next_step", `title.ilike.${like}`, "/goals"],
    ["brain_dump_notes", "Catatan", "id,title,content,updated_at", `title.ilike.${like},content.ilike.${like}`, "/notes"],
    ["smart_inbox_items", "Inbox", "id,content,status,created_at", `content.ilike.${like}`, "/inbox"],
    ["schedule_blocks", "Kalender", "id,title,block_date,start_time,end_time,task_id,project_id", `title.ilike.${like}`, "/calendar"],
    ["decisions", "Keputusan", "id,title,decision,outcome,review_date", `title.ilike.${like},decision.ilike.${like}`, "/decisions"],
    ["user_memories", "Memori", "id,memory_key,memory_value,confidence,importance", `memory_key.ilike.${like},memory_value.ilike.${like}`, "/memory"],
    ["vault_items", "Vault", "id,title,content,item_type,tags,pinned", `title.ilike.${like},content.ilike.${like}`, "/vault"],
    ["reading_logs", "Bacaan", "id,title,status,progress,rating", `title.ilike.${like}`, "/reading"],
    ["skills", "Keahlian", "id,name,level,next_action,target_date", `name.ilike.${like}`, "/learning"],
  ] as const;
  const results:any[] = [];
  const responses = await Promise.all(queries.map(async ([table,type,select,filter,href]) => ({ table,type,href,...(await supabase.from(table).select(select).eq("user_id", user.id).or(filter).limit(12)) })));
  for (const r of responses) for (const row of r.data ?? []) results.push({ id: String((row as any).id), type: r.type, href: r.href, title: (row as any).title || (row as any).name || (row as any).memory_key || "Tanpa judul", detail: String((row as any).content || (row as any).decision || (row as any).status || (row as any).memory_value || "").slice(0, 180) });
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const context = await buildCopilotContext(supabase, user.id, String(profile?.timezone || "Asia/Jakarta"));
  const related = context.evidence.filter((x) => `${x.label} ${x.detail}`.toLowerCase().includes(q.toLowerCase()) || x.sourceType.toLowerCase().includes(q.toLowerCase())).slice(0,6);
  return NextResponse.json({ ok: true, query: q, results: results.slice(0,100), grouped: Object.entries(results.reduce<Record<string,number>>((m:any,x:any)=>(m[x.type]=(m[x.type]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]), related });
}
