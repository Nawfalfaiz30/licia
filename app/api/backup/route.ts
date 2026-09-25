import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertJsonSize, enforceSameOrigin, rateLimit } from "@/lib/security";

const TABLES=[
  "areas","accounts","goals","projects","tasks","subtasks","schedule_blocks","pomodoro_sessions","smart_inbox_items","brain_dump_notes","decisions","skills","reading_logs","habits","habit_checkins","expenses","incomes","budgets","subscriptions","hydration_logs","caffeine_logs","meal_logs","medication_logs","fatigue_logs","sleep_logs","daily_plans","goal_milestones","movement_logs","reading_sessions","health_metrics","user_memories","automations","vault_items","reminders","notification_events","ai_action_history",
] as const;
export async function GET(req:Request){
  const originError=enforceSameOrigin(req);if(originError)return originError;
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Belum masuk."},{status:401});
  const gate=rateLimit(`backup:get:${user.id}`,3,60_000);if(gate)return gate;
  const{data:profile}=await supabase.from("users").select("display_name,timezone,preferences").eq("id",user.id).single();
  const entries=await Promise.all(TABLES.map(async table=>{const{data,error}=await supabase.from(table).select("*").eq("user_id",user.id);return[table,error?[]:data??[]] as const;}));
  const tables=Object.fromEntries(entries);
  const payload={format:"licia-backup",version:2,created_at:new Date().toISOString(),profile:profile??{},tables};
  return new NextResponse(JSON.stringify(payload),{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="licia-backup-${new Date().toISOString().slice(0,10)}.json"`,"Cache-Control":"no-store"}});
}

export async function POST(req:Request){
  const originError=enforceSameOrigin(req);if(originError)return originError;
  const sizeError=assertJsonSize(req,10*1024*1024);if(sizeError)return sizeError;
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Belum masuk."},{status:401});
  const gate=rateLimit(`backup:post:${user.id}`,2,60_000);if(gate)return gate;
  let body:any;try{body=await req.json()}catch{return NextResponse.json({error:"File backup bukan JSON valid."},{status:400})}
  const serialized=JSON.stringify(body);if(serialized.length>10*1024*1024)return NextResponse.json({error:"Payload backup terlalu besar. Batas sekitar 10 MB."},{status:413});
  if(body?.format!=="licia-backup"||![1,2].includes(Number(body?.version))||!body?.tables||typeof body.tables!=="object")return NextResponse.json({error:"Format backup Licia tidak dikenali."},{status:400});
  const profile=body.profile&&typeof body.profile==="object"?body.profile:{};
  if(profile.display_name!==undefined||profile.timezone!==undefined||profile.preferences!==undefined){const{error}=await supabase.from("users").upsert({id:user.id,display_name:String(profile.display_name||"").trim(),timezone:String(profile.timezone||"Asia/Jakarta"),preferences:profile.preferences??{}});if(error)return NextResponse.json({error:`Profil gagal dipulihkan: ${error.message}`},{status:400})}
  const restored:Record<string,number>={};const errors:{table:string;error:string}[]=[];
  for(const table of TABLES){const rows=body.tables?.[table];if(!Array.isArray(rows)||!rows.length)continue;if(rows.length>5000){errors.push({table,error:"Melebihi batas 5000 entri per tabel."});continue;}const safe=rows.map((row:any)=>{const copy=row&&typeof row==="object"?{...row}:{};delete copy.user_id;copy.user_id=user.id;return copy;});const{error}=await supabase.from(table).upsert(safe,{onConflict:"id"});if(error)errors.push({table,error:error.message});else restored[table]=safe.length;}
  return NextResponse.json({ok:errors.length===0,restored,errors,mode:"merge",message:errors.length?"Backup dipulihkan sebagian; beberapa tabel gagal.":"Backup berhasil digabungkan dengan data saat ini."},{status:errors.length?207:200});
}
