import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateStrInTimezone } from "@/lib/date";
import { rateLimit } from "@/lib/security";
import { previewPlainText } from "@/lib/text";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ activities: [] }, { status: 401 });
  const gate = rateLimit(`activity:${user.id}`, 60, 60_000); if (gate) return gate;
  const url = new URL(req.url);
  const limit = Math.min(30, Math.max(6, Number(url.searchParams.get("limit")) || 12));
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();
  const timezone = profile?.timezone || "Asia/Jakarta";
  const [tasks, focus, expenses, incomes, notes, agendas, goals, projects, habits, inbox, aiActions] = await Promise.all([
    supabase.from("tasks").select("id,title,updated_at").eq("user_id", user.id).eq("status", "done").order("updated_at", { ascending: false }).limit(limit),
    supabase.from("pomodoro_sessions").select("id,focus_minutes,started_at").eq("user_id", user.id).order("started_at", { ascending: false }).limit(limit),
    supabase.from("expenses").select("id,amount,category,occurred_at").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(limit),
    supabase.from("incomes").select("id,amount,source,occurred_at").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(limit),
    supabase.from("brain_dump_notes").select("id,title,content,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(limit),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("user_id", user.id).gte("block_date", dateStrInTimezone(new Date(Date.now() - 3 * 86400000), timezone)).order("block_date", { ascending: false }).order("start_time", { ascending: false }).limit(limit),
    supabase.from("goals").select("id,title,progress,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(limit),
    supabase.from("projects").select("id,name,status,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(limit),
    supabase.from("habit_checkins").select("id,checkin_date,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit),
    supabase.from("smart_inbox_items").select("id,content,created_at,status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit),
    supabase.from("ai_action_history").select("id,label,tool_name,operation,created_at,undone_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit),
  ]);
  const activities = [
    ...(tasks.data ?? []).map((x:any)=>({id:`task-${x.id}`,at:x.updated_at,title:x.title,detail:"Tugas selesai",kind:"Tugas",href:"/tasks"})),
    ...(focus.data ?? []).map((x:any)=>({id:`focus-${x.id}`,at:x.started_at,title:`Fokus ${x.focus_minutes} menit`,detail:"Sesi fokus",kind:"Fokus",href:"/focus"})),
    ...(expenses.data ?? []).map((x:any)=>({id:`expense-${x.id}`,at:x.occurred_at,title:`- Rp ${Number(x.amount).toLocaleString("id-ID")}`,detail:`${x.category}`,kind:"Keuangan",href:"/finance"})),
    ...(incomes.data ?? []).map((x:any)=>({id:`income-${x.id}`,at:x.occurred_at,title:`+ Rp ${Number(x.amount).toLocaleString("id-ID")}`,detail:`${x.source}`,kind:"Keuangan",href:"/finance"})),
    ...(notes.data ?? []).map((x:any)=>({id:`note-${x.id}`,at:x.updated_at,title:x.title || previewPlainText(x.content, 100) || "Catatan",detail:"Catatan diperbarui",kind:"Catatan",href:"/notes"})),
    ...(agendas.data ?? []).map((x:any)=>({id:`agenda-${x.id}`,at:`${x.block_date}T${x.start_time}`,title:x.title,detail:`Agenda ${String(x.start_time).slice(0,5)}–${String(x.end_time).slice(0,5)}`,kind:"Agenda",href:"/calendar"})),
    ...(goals.data ?? []).map((x:any)=>({id:`goal-${x.id}`,at:x.updated_at,title:x.title,detail:`Target ${Number(x.progress || 0)}%`,kind:"Target",href:"/goals"})),
    ...(projects.data ?? []).map((x:any)=>({id:`project-${x.id}`,at:x.updated_at,title:x.name,detail:`Proyek · ${x.status}`,kind:"Proyek",href:"/projects"})),
    ...(habits.data ?? []).map((x:any)=>({id:`habit-${x.id}`,at:x.created_at,title:"Rutinitas dicentang",detail:x.checkin_date,kind:"Rutinitas",href:"/habits"})),
    ...(inbox.data ?? []).map((x:any)=>({id:`inbox-${x.id}`,at:x.created_at,title:previewPlainText(x.content, 120) || "Inbox",detail:`Inbox · ${x.status}`,kind:"Inbox",href:"/inbox"})),
    ...(aiActions.data ?? []).map((x:any)=>({id:`ai-${x.id}`,at:x.created_at,title:x.label,detail:x.undone_at?"Aksi Licia · dibatalkan":`Aksi Licia · ${x.operation}`,kind:"Licia",href:"/chat"})),
  ].sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0, limit);
  return NextResponse.json({ timezone, activities });
}
