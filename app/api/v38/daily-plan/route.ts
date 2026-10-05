import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { dateStrInTimezone, startOfDayIsoForTimezone, endOfDayIsoForTimezone } from "@/lib/date";
import { selectAiModel } from "@/lib/ai/modelRouter";
import { chatCompletion, generationOptions, logCompletionFinish, withOpenAIRetry } from "@/lib/ai/runtime";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let client: OpenAI | null = null;
function openai() { if (client) return client; const key = process.env.OPENAI_API_KEY?.trim(); if (!key) throw new Error("OPENAI_API_KEY belum dikonfigurasi di server."); client = new OpenAI({ apiKey: key }); return client; }
function addMinutes(hhmm: string, minutes: number) { const [h, m] = hhmm.split(":").map(Number); const total = Math.max(0, Math.min(23 * 60 + 30, h * 60 + m + minutes)); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
function localHour(now: Date, timezone: string) { return Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(now)); }
function scoreTask(task: any, now: Date) { let score = 0; if (task.priority === "high") score += 35; else if (task.priority === "medium") score += 18; if (task.due_at) { const diff = (new Date(task.due_at).getTime() - now.getTime()) / 86400000; if (diff < 0) score += 45; else if (diff <= 1) score += 38; else if (diff <= 3) score += 25; else if (diff <= 7) score += 10; } return score; }

export async function GET(req: Request) {
  const sameOrigin = enforceSameOrigin(req); if (sameOrigin) return sameOrigin;
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`v38-daily-plan:${user.id}`, 30, 60_000); if (gate) return gate;
  const { data: profile } = await supabase.from("users").select("display_name,timezone").eq("id", user.id).maybeSingle();
  const resolved = profile ?? await getOrCreateProfile(supabase, user.id, user.user_metadata?.display_name);
  const timezone = String((resolved as any)?.timezone || "Asia/Jakarta"); const now = new Date(); const today = dateStrInTimezone(now, timezone);
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const [tasksRes, agendaRes, goalsRes, focusRes] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes,project_id").eq("user_id", user.id).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(40),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,task_id,completed_at").eq("user_id", user.id).eq("block_date", today).order("start_time", { ascending: true }).limit(60),
    supabase.from("goals").select("id,title,progress,target_date,next_step").eq("user_id", user.id).eq("status", "active").order("target_date", { ascending: true, nullsFirst: false }).limit(10),
    supabase.from("pomodoro_sessions").select("focus_minutes").eq("user_id", user.id).gte("started_at", startOfDayIsoForTimezone(now, timezone)).lte("started_at", endOfDayIsoForTimezone(now, timezone)).limit(100),
  ]);
  const tasks = tasksRes.data || []; const agenda = agendaRes.data || []; const goals = goalsRes.data || [];
  const availableMinutes = agenda.filter((x:any) => !x.completed_at).reduce((acc:number, x:any, i:number) => acc, 0) >= 0 ? (() => {
    const hour = localHour(now, timezone); const start = Math.max(hour + 1, 7); const end = 22; const booked = agenda.filter((x:any)=>!x.completed_at).reduce((sum:number,x:any)=>{ const a=String(x.start_time).slice(0,5).split(":").map(Number); const b=String(x.end_time).slice(0,5).split(":").map(Number); return sum + Math.max(0,(b[0]*60+b[1])-(a[0]*60+a[1])); },0); return Math.max(0,(end-start)*60-booked);
  })() : 0;
  const focusToday = (focusRes.data || []).reduce((sum:any, x:any)=>sum+Number(x.focus_minutes||0),0);
  const ranked = tasks.map((task:any)=>({...task,_score:scoreTask(task,now)})).sort((a,b)=>b._score-a._score);
  const priorities = ranked.slice(0,3).map((task:any,index)=>({ id: String(task.id), title: task.title, reason: task.due_at ? `Deadline ${new Intl.DateTimeFormat("id-ID", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(task.due_at))}.` : index===0 ? "Prioritas tertinggi dari tugas terbuka hari ini." : "Masih terbuka dan cocok dijadikan fokus berikutnya.", href: "/tasks" }));
  const conflicts = agenda.filter((x:any,i:number)=>i>0 && String(x.start_time).slice(0,8) < String(agenda[i-1].end_time).slice(0,8)).map((x:any)=>`Agenda ${x.title} berpotensi bertabrakan dengan agenda sebelumnya.`);
  const focusMinutes = Math.min(180, Math.max(25, availableMinutes >= 90 ? 50 : availableMinutes >= 50 ? 40 : 25));
  const currentHour = Math.min(20, Math.max(7, localHour(now,timezone)+1));
  const startTime = `${String(currentHour).padStart(2,"0")}:00`;
  const blocks = priorities.slice(0, Math.min(3, Math.max(1, Math.floor(availableMinutes / Math.max(25, focusMinutes))))).map((task:any,index)=>({ start_time: addMinutes(startTime,index*(focusMinutes+15)), end_time: addMinutes(startTime,index*(focusMinutes+15)+focusMinutes), title: task.title, task_id: task.id, reason: index===0 ? "Prioritas hari ini." : "Slot fokus berikutnya." }));
  let focus = priorities[0]?.title ? `Selesaikan “${priorities[0].title}” sebelum menambah pekerjaan baru.` : goals[0]?.title ? `Dorong target “${goals[0].title}” dengan satu langkah konkret.` : "Jaga satu fokus utama dan sisakan ruang untuk hal yang muncul.";
  if (focusToday >= 180) focus = "Kamu sudah punya 180+ menit fokus hari ini. Pertahankan ritme tanpa memadatkan jadwal lebih jauh.";

  let aiSource = "deterministic";
  if (refresh && process.env.OPENAI_API_KEY && priorities.length) {
    try {
      const model = selectAiModel({ text: "Susun daily plan dari tasks, agenda, goals, dan ruang waktu", domains: ["tasks","calendar","goals"], mode: "planner" });
      const completion = await withOpenAIRetry(() => chatCompletion(openai(), { model, ...generationOptions(model, 0.15), max_completion_tokens: 500, response_format: { type: "json_object" }, messages: [
        { role: "system", content: `Susun smart daily plan realistis untuk tanggal ${today} timezone ${timezone}. Jangan mengarang data. Maksimal 3 prioritas, maksimal 3 blok. Jangan menambah komitmen baru pada kalender, hanya rekomendasi. JSON: {"focus":string,"priority_reasons":string[],"block_minutes":number}` },
        { role: "user", content: JSON.stringify({ priorities: priorities.map((p:any)=>({title:p.title,reason:p.reason})), goals: goals.slice(0,4), agenda, availableMinutes, focusToday }) },
      ] }), 1);
      logCompletionFinish(completion, "daily-plan");
      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      if (typeof parsed.focus === "string" && parsed.focus.trim()) focus = parsed.focus.trim();
      if (Number.isFinite(Number(parsed.block_minutes))) { const min = Math.max(25, Math.min(75, Number(parsed.block_minutes))); for (const block of blocks) { const start = block.start_time; block.end_time = addMinutes(start,min); block.reason = "Rekomendasi planner AI berdasarkan context hari ini."; } }
      if (Array.isArray(parsed.priority_reasons)) priorities.forEach((p:any,i:number)=>{ if (typeof parsed.priority_reasons[i]==="string") p.reason = parsed.priority_reasons[i].slice(0,220); });
      aiSource = model;
    } catch {}
  }
  const plan = { date: today, focus, priorities, blocks, open_tasks: tasks.length, available_minutes: availableMinutes, suggested_focus_minutes: focusMinutes, conflicts, focus_today_minutes: focusToday, source: aiSource };
  return NextResponse.json({ ok:true, plan, refresh, generatedAt: now.toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
}
