import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security";
import { previewPlainText } from "@/lib/text";

export async function GET(req: Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({results:[]},{status:401});
  const gate=rateLimit(`search:${user.id}`,60,60_000); if(gate) return gate;
  const q=(new URL(req.url).searchParams.get("q")||"").trim().slice(0,80);
  if(q.length<2) return NextResponse.json({results:[]});
  const like=`%${q.replace(/[%_]/g,"\\$&")}%`;
  const [tasks,projects,goals,notes,inbox,reading,subscriptions,decisions,skills,areas,memory,vault,automations,agenda]=await Promise.all([
    supabase.from("tasks").select("id,title,status,due_at").eq("user_id",user.id).or(`title.ilike.${like}`).order("due_at",{ascending:true,nullsFirst:false}).limit(8),
    supabase.from("projects").select("id,name,status,target_date").eq("user_id",user.id).or(`name.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("goals").select("id,title,status,target_date").eq("user_id",user.id).or(`title.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("brain_dump_notes").select("id,title,content,updated_at").eq("user_id",user.id).or(`title.ilike.${like},content.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("smart_inbox_items").select("id,content,status,created_at").eq("user_id",user.id).or(`content.ilike.${like}`).order("created_at",{ascending:false}).limit(8),
    supabase.from("reading_logs").select("id,title,author,status").eq("user_id",user.id).or(`title.ilike.${like},author.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("subscriptions").select("id,name,category,active,next_billing_date").eq("user_id",user.id).or(`name.ilike.${like},category.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("decisions").select("id,title,outcome,review_date").eq("user_id",user.id).or(`title.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("skills").select("id,name,category,level").eq("user_id",user.id).or(`name.ilike.${like},category.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("areas").select("id,name").eq("user_id",user.id).or(`name.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("user_memories").select("id,memory_key,memory_value,category").eq("user_id",user.id).or(`memory_key.ilike.${like},memory_value.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("vault_items").select("id,title,item_type,tags").eq("user_id",user.id).or(`title.ilike.${like},content.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("automations").select("id,name,trigger_type,action_type,enabled").eq("user_id",user.id).or(`name.ilike.${like}`).order("updated_at",{ascending:false}).limit(8),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("user_id",user.id).or(`title.ilike.${like}`).order("block_date",{ascending:true}).limit(8),
  ]);
  const results=[
    ...((tasks.data||[]).map((x:any)=>({id:x.id,type:"Tugas",title:x.title,detail:x.status==="done"?"Selesai":(x.due_at?new Date(x.due_at).toLocaleDateString("id-ID",{day:"numeric",month:"short"}):"Tanpa tenggat"),href:"/tasks"}))),
    ...((projects.data||[]).map((x:any)=>({id:x.id,type:"Proyek",title:x.name,detail:x.status,href:"/projects"}))),
    ...((goals.data||[]).map((x:any)=>({id:x.id,type:"Target",title:x.title,detail:x.status,href:"/goals"}))),
    ...((notes.data||[]).map((x:any)=>({id:x.id,type:"Catatan",title:x.title||"Tanpa judul",detail:previewPlainText(x.content, 90) || "Catatan",href:"/notes"}))),
    ...((inbox.data||[]).map((x:any)=>({id:x.id,type:"Inbox",title:previewPlainText(x.content, 120) || "Inbox",detail:x.status==="open"?"Belum dipilah":"Diproses",href:"/inbox"}))),
    ...((reading.data||[]).map((x:any)=>({id:x.id,type:"Bacaan",title:x.title,detail:x.author||x.status,href:"/reading"}))),
    ...((subscriptions.data||[]).map((x:any)=>({id:x.id,type:"Langganan",title:x.name,detail:x.active?"Aktif":"Nonaktif",href:"/subscriptions"}))),
    ...((decisions.data||[]).map((x:any)=>({id:x.id,type:"Keputusan",title:x.title,detail:x.outcome?"Sudah ditinjau":"Perlu ditinjau",href:"/decisions"}))),
    ...((skills.data||[]).map((x:any)=>({id:x.id,type:"Pembelajaran",title:x.name,detail:`Level ${x.level||0}%`,href:"/learning"}))),
    ...((areas.data||[]).map((x:any)=>({id:x.id,type:"Area",title:x.name,detail:"Area",href:"/life-map"}))),
    ...((memory.data||[]).map((x:any)=>({id:x.id,type:"Memori",title:x.memory_key,detail:x.category,href:"/memory"}))),
    ...((vault.data||[]).map((x:any)=>({id:x.id,type:"Vault",title:x.title,detail:x.item_type,href:"/vault"}))),
    ...((automations.data||[]).map((x:any)=>({id:x.id,type:"Otomatisasi",title:x.name,detail:x.enabled?"Aktif":"Mati",href:"/automations"}))),
    ...((agenda.data||[]).map((x:any)=>({id:x.id,type:"Kalender",title:x.title,detail:`${x.block_date} · ${String(x.start_time).slice(0,5)}`,href:"/calendar"}))),
  ];
  return NextResponse.json({results:results.slice(0,40)},{headers:{"Cache-Control":"private, no-store"}});
}
