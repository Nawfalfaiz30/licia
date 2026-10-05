import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, assertJsonSize } from "@/lib/security";
import { dateStrInTimezone } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const body = await req.json().catch(() => ({}));
  try { assertJsonSize(body, 30_000); } catch { return NextResponse.json({ error: "Input terlalu besar." }, { status: 413 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const timezone = String(profile?.timezone || "Asia/Jakarta");
  const from = String(body?.from || dateStrInTimezone(new Date(), timezone));
  const to = String(body?.to || dateStrInTimezone(new Date(Date.now() + 7 * 86400000), timezone));
  const shiftMinutes = Number(body?.shiftMinutes || 0);
  const shiftDays = Math.max(-30, Math.min(30, Number(body?.shiftDays || 0)));
  const excludeTaskKeyword = String(body?.excludeTaskKeyword || "").trim().toLowerCase();
  const [tasksRes, agendaRes] = await Promise.all([
    supabase.from("tasks").select("id,title,due_at,estimated_minutes,priority,status").eq("user_id", user.id).neq("status", "done").limit(150),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("user_id", user.id).gte("block_date", from).lte("block_date", to).order("block_date").order("start_time").limit(300),
  ]);
  if (tasksRes.error || agendaRes.error) return NextResponse.json({ error: tasksRes.error?.message || agendaRes.error?.message || "Data planner tidak tersedia." }, { status: 500 });
  const tasks = (tasksRes.data ?? []).filter((task) => !excludeTaskKeyword || !String(task.title).toLowerCase().includes(excludeTaskKeyword));
  const agenda = (agendaRes.data ?? []).map((item) => ({ ...item, simulated_date: shiftDate(String(item.block_date), shiftDays), simulated_start: shiftTime(String(item.start_time), shiftMinutes), simulated_end: shiftTime(String(item.end_time), shiftMinutes) }));
  const conflicts: any[] = [];
  const byDate = new Map<string, any[]>();
  for (const item of agenda) {
    const list = byDate.get(String(item.simulated_date)) ?? [];
    list.push(item);
    byDate.set(String(item.block_date), list);
  }
  for (const [date, list] of byDate) {
    const sorted = list.slice().sort((a, b) => a.simulated_start.localeCompare(b.simulated_start));
    for (let i = 1; i < sorted.length; i++) if (sorted[i].simulated_start < sorted[i - 1].simulated_end) conflicts.push({ date, first: sorted[i - 1].title, second: sorted[i].title });
  }
  const workload = tasks.reduce((sum, task) => sum + Number(task.estimated_minutes || 25), 0);
  const result = { ok: true, simulationOnly: true, range: { from, to }, shiftMinutes, shiftDays, affectedTasks: tasks.length, workloadMinutes: workload, agendaCount: agenda.length, conflicts, summary: conflicts.length ? `${conflicts.length} konflik terdeteksi pada simulasi.` : "Tidak ada konflik baru pada simulasi.", changes: { agenda: agenda.slice(0, 40) } };
  const { data: saved } = await supabase.from("ai_what_if_runs").insert({ user_id: user.id, title: String(body?.title || "Simulasi planner"), input: { from, to, shiftMinutes, excludeTaskKeyword }, result }).select("id,created_at").maybeSingle();
  return NextResponse.json({ ...result, run: saved || null });
}

function shiftTime(time: string, delta: number) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const total = ((h * 60 + m + delta) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

function shiftDate(date: string, days: number) { const base = new Date(`${date}T12:00:00Z`); if (Number.isNaN(base.getTime())) return date; base.setUTCDate(base.getUTCDate() + days); return base.toISOString().slice(0, 10); }
