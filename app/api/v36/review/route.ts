import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { dateStrInTimezone, startOfWeekIsoForTimezone } from "@/lib/date";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle(); const tz = String(profile?.timezone || "Asia/Jakarta"); const now = new Date(); const today = dateStrInTimezone(now,tz); const weekStart=startOfWeekIsoForTimezone(now,tz);
  const [done,tasks,focus,inbox,events,goals,projects] = await Promise.all([
    supabase.from("tasks").select("id,title,updated_at").eq("user_id",user.id).eq("status","done").gte("updated_at",weekStart).limit(200),
    supabase.from("tasks").select("id,title,status,due_at,updated_at").eq("user_id",user.id).neq("status","done").limit(200),
    supabase.from("pomodoro_sessions").select("focus_minutes,started_at").eq("user_id",user.id).gte("started_at",weekStart).limit(200),
    supabase.from("smart_inbox_items").select("id,status,created_at,processed_at").eq("user_id",user.id).gte("created_at",weekStart).limit(200),
    supabase.from("life_os_events").select("event_type,created_at,entity_type").eq("user_id",user.id).gte("created_at",weekStart).order("created_at",{ascending:false}).limit(300),
    supabase.from("goals").select("id,title,progress,target_date,status,updated_at").eq("user_id",user.id).eq("status","active").limit(80),
    supabase.from("projects").select("id,name,status,target_date,updated_at").eq("user_id",user.id).in("status",["active","paused"]).limit(80),
  ]);
  const focusMinutes=(focus.data??[]).reduce((n:number,x:any)=>n+Number(x.focus_minutes||0),0); const daysFocused=new Set((focus.data??[]).map((x:any)=>String(x.started_at).slice(0,10))).size; const processed=(inbox.data??[]).filter((x:any)=>x.status!=="open" || x.processed_at).length; const overdue=(tasks.data??[]).filter((x:any)=>x.due_at && new Date(x.due_at).getTime()<now.getTime()).length;
  const stale=(projects.data??[]).filter((p:any)=>p.updated_at && now.getTime()-new Date(p.updated_at).getTime()>3*86400000); const atRisk=(goals.data??[]).filter((g:any)=>g.target_date && Number(g.progress||0)<70 && new Date(`${g.target_date}T23:59:59`).getTime()-now.getTime()<14*86400000);
  const narrative = done.data?.length ? `Minggu ini ada ${done.data.length} tugas selesai dan ${focusMinutes} menit fokus. ${overdue ? `${overdue} tugas aktif masih terlambat. ` : ""}${stale.length ? `${stale.length} proyek perlu ditinjau. ` : ""}` : "Belum banyak aktivitas minggu ini; gunakan review untuk menetapkan satu fokus yang realistis.";
  return NextResponse.json({ ok:true, date:today, stats:{completedTasks:done.data?.length??0,openTasks:tasks.data?.length??0,overdueTasks:overdue,focusMinutes,focusDays:daysFocused,inboxProcessed:processed,events:events.data?.length??0,staleProjects:stale.length,atRiskGoals:atRisk.length}, narrative, highlights:{completed:(done.data??[]).slice(0,8),staleProjects:stale.slice(0,5),atRiskGoals:atRisk.slice(0,5)} });
}
