import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { dateStrInTimezone } from "@/lib/date";
import { memoizeUserContext } from "@/lib/ai/contextCache";
export const dynamic = "force-dynamic";
export async function GET(req: Request){
  const originError=enforceSameOrigin(req); if(originError)return originError;
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Belum masuk."},{status:401});
  const {data:profile}=await supabase.from("users").select("timezone").eq("id",user.id).maybeSingle(); const tz=String(profile?.timezone||"Asia/Jakarta");
  const result=await memoizeUserContext(`${user.id}:v35:review`,async()=>{
    const now=new Date(); const today=dateStrInTimezone(now,tz); const start=new Date(now.getTime()-7*86400000).toISOString();
    const [done,created,focus,goals,expenses,agenda]=await Promise.all([
      supabase.from("tasks").select("id,title,updated_at").eq("user_id",user.id).eq("status","done").gte("updated_at",start).limit(200),
      supabase.from("tasks").select("id,title,created_at").eq("user_id",user.id).gte("created_at",start).limit(200),
      supabase.from("pomodoro_sessions").select("focus_minutes,started_at").eq("user_id",user.id).gte("started_at",start).limit(200),
      supabase.from("goals").select("id,title,progress,target_date").eq("user_id",user.id).eq("status","active").limit(20),
      supabase.from("expenses").select("amount,category,occurred_at").eq("user_id",user.id).gte("occurred_at",start).limit(500),
      supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("user_id",user.id).gte("block_date",dateStrInTimezone(new Date(now.getTime()-6*86400000),tz)).lte("block_date",today).limit(200),
    ]);
    const focusMinutes=(focus.data||[]).reduce((n:any,x:any)=>n+Number(x.focus_minutes||0),0); const spend=(expenses.data||[]).reduce((n:any,x:any)=>n+Number(x.amount||0),0);
    const doneIds=new Set((done.data||[]).map((x:any)=>x.id));
    return {ok:true,rangeStart:start,rangeEnd:now.toISOString(),completedTasks:(done.data||[]).length,createdTasks:(created.data||[]).length,focusMinutes,expenseTotal:spend,agendaCount:(agenda.data||[]).length,goalProgress:(goals.data||[]).map((g:any)=>({title:g.title,progress:Number(g.progress||0),targetDate:g.target_date})),unfinished:(created.data||[]).filter((t:any)=>!doneIds.has(t.id)).slice(0,8)};
  },15000);
  return NextResponse.json(result,{headers:{"Cache-Control":"private, max-age=15"}});
}
